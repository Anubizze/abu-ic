// Общая логика авторизации для админских страниц
(function () {
    const AUTH_EVENT_LOGIN = 'abu-admin-authenticated';
    const AUTH_EVENT_LOGOUT = 'abu-admin-logout';
    const DEFAULT_LOGIN_PAGE = 'admin-login.html';
    const DEFAULT_HOME_PAGE = 'admin-documents.html';
    const PROTECTED_SELECTOR = '[data-auth-protected]';

    let supabaseReadyPromise = null;
    let authSubscription = null;

    const SESSION_STORAGE_KEY = 'abu_admin_session';
    
    const authState = {
        isAuthenticated: false,
        session: null
    };

    function createLoginUrl(target, message) {
        const url = new URL(target || DEFAULT_LOGIN_PAGE, window.location.href);
        if (message) {
            url.searchParams.set('message', message);
        }
        return url;
    }

    async function ensureSupabaseReady(maxWait = 5000) {
        if (supabaseReadyPromise) {
            return supabaseReadyPromise;
        }

        supabaseReadyPromise = new Promise((resolve, reject) => {
            const start = Date.now();

            const check = () => {
                if (typeof supabase !== 'undefined' && supabase) {
                    resolve(supabase);
                    return;
                }

                if (Date.now() - start > maxWait) {
                    reject(new Error('Supabase не инициализирован'));
                    return;
                }

                setTimeout(check, 50);
            };

            check();
        });

        return supabaseReadyPromise;
    }

    function applySession(session, { silent = false } = {}) {
        const previousSession = authState.session;
        authState.session = session;
        authState.isAuthenticated = Boolean(session);

        // Сохраняем сессию в localStorage
        if (session) {
            try {
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
                    id: session.id,
                    username: session.username,
                    expiresAt: session.expiresAt || Date.now() + (24 * 60 * 60 * 1000) // 24 часа по умолчанию
                }));
            } catch (e) {
                console.error('Ошибка сохранения сессии:', e);
            }
        }

        if (!silent && session?.username) {
            console.info('Пользователь авторизован:', session.username);
        }

        if (session && (!previousSession || previousSession.id !== session.id)) {
            window.dispatchEvent(
                new CustomEvent(AUTH_EVENT_LOGIN, { detail: { session } })
            );
        }
    }

    function clearSession({ silent = false } = {}) {
        if (!silent && authState.isAuthenticated) {
            console.info('Пользователь вышел из аккаунта');
        }

        authState.session = null;
        authState.isAuthenticated = false;
        
        // Удаляем сессию из localStorage
        try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (e) {
            console.error('Ошибка удаления сессии:', e);
        }
        
        window.dispatchEvent(new CustomEvent(AUTH_EVENT_LOGOUT));
    }

    async function getSession() {
        await ensureSupabaseReady();

        try {
            // Проверяем сессию в localStorage
            const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
            if (!storedSession) {
                clearSession({ silent: true });
                return null;
            }

            const session = JSON.parse(storedSession);
            
            // Проверяем, не истекла ли сессия
            if (session.expiresAt && Date.now() > session.expiresAt) {
                clearSession({ silent: true });
                return null;
            }

            // Восстанавливаем сессию
            applySession(session, { silent: true });
            return session;
        } catch (error) {
            console.error('Ошибка получения сессии:', error);
            clearSession({ silent: true });
            return null;
        }
    }

    async function login(username, password) {
        await ensureSupabaseReady();

        // Вызываем RPC функцию для проверки учетных данных
        const { data, error } = await supabase.rpc('verify_admin_credentials', {
            p_username: username,
            p_password: password
        });

        if (error) {
            console.error('Ошибка проверки учетных данных:', error);
            throw new Error('Ошибка при проверке учетных данных. Попробуйте позже.');
        }

        // Проверяем результат
        if (!data || !Array.isArray(data) || data.length === 0 || !data[0].success) {
            throw new Error('Неверный логин или пароль.');
        }

        const userData = data[0];
        
        // Создаем сессию
        const session = {
            id: userData.id,
            username: userData.username,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 часа
        };

        applySession(session);
        return session;
    }

    async function logout({ redirect = true, loginPage, returnTo } = {}) {
        try {
            // Просто очищаем сессию, так как мы не используем Supabase Auth
            clearSession();
        } catch (error) {
            console.error('Ошибка при выходе из аккаунта:', error);
        } finally {
            if (redirect) {
                const url = createLoginUrl(loginPage || DEFAULT_LOGIN_PAGE, 'logged_out');
                if (returnTo) {
                    url.searchParams.set('redirect', returnTo);
                }
                window.location.replace(url.toString());
            }
        }
    }

    async function requireAuth({ returnTo, loginPage } = {}) {
        await ensureSupabaseReady();
        const session = await getSession();

        if (session) {
            return session;
        }

        const url = createLoginUrl(loginPage || DEFAULT_LOGIN_PAGE);
        url.searchParams.set('redirect', returnTo || getCurrentPath());
        window.location.replace(url.toString());
        return null;
    }

    async function guardAdminPage({
        returnTo,
        loginPage,
        logoutSelector = '#adminLogoutBtn',
        protectedSelector = PROTECTED_SELECTOR
    } = {}) {
        const session = await requireAuth({ returnTo, loginPage });
        if (!session) return;

        showProtectedSections(protectedSelector);
        bindLogoutButton(logoutSelector, { redirect: true, loginPage, returnTo });
    }

    async function redirectIfAuthenticated({ redirectTo } = {}) {
        await ensureSupabaseReady();
        const session = await getSession();
        if (session) {
            window.location.replace(redirectTo || DEFAULT_HOME_PAGE);
        }
    }

    function bindLogoutButton(selector, options = {}) {
        if (!selector) return;
        const button = document.querySelector(selector);
        if (!button || button.dataset.authHandlerBound === 'true') return;

        button.dataset.authHandlerBound = 'true';
        button.style.display = 'inline-flex';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            logout(options);
        });
    }

    function showProtectedSections(selector = PROTECTED_SELECTOR) {
        document.querySelectorAll(selector).forEach((element) => {
            element.classList.remove('auth-hidden');
        });
    }

    function getCurrentPath() {
        const { pathname, search } = window.location;
        return `${pathname}${search}`;
    }

    const api = {
        get isAuthenticated() {
            return authState.isAuthenticated;
        },
        get session() {
            return authState.session;
        },
        ensureSupabaseReady,
        getSession,
        login,
        logout,
        requireAuth,
        guardAdminPage,
        redirectIfAuthenticated
    };

    window.ABU_ADMIN_AUTH = api;
})();