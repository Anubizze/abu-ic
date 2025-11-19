// Общая логика авторизации для админских страниц
(function () {
    const AUTH_EVENT_LOGIN = 'abu-admin-authenticated';
    const AUTH_EVENT_LOGOUT = 'abu-admin-logout';
    const DEFAULT_LOGIN_PAGE = 'admin-login.html';
    const DEFAULT_HOME_PAGE = 'admin-documents.html';
    const PROTECTED_SELECTOR = '[data-auth-protected]';

    let supabaseReadyPromise = null;
    let authSubscription = null;

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
                    if (!authSubscription && supabase.auth?.onAuthStateChange) {
                        authSubscription = supabase.auth.onAuthStateChange((event, session) => {
                            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
                                applySession(session, { silent: true });
                            }

                            if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
                                clearSession({ silent: true });
                            }
                        });
                    }

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
        const previousToken = authState.session?.access_token;
        authState.session = session;
        authState.isAuthenticated = Boolean(session);

        if (!silent && session?.user?.email) {
            console.info('Пользователь авторизован:', session.user.email);
        }

        if (session?.access_token && session.access_token !== previousToken) {
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
        window.dispatchEvent(new CustomEvent(AUTH_EVENT_LOGOUT));
    }

    async function getSession() {
        await ensureSupabaseReady();

        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;

            if (data?.session) {
                applySession(data.session, { silent: true });
                return data.session;
            }

            clearSession({ silent: true });
            return null;
        } catch (error) {
            console.error('Ошибка получения сессии Supabase:', error);
            clearSession({ silent: true });
            return null;
        }
    }

    async function login(email, password) {
        await ensureSupabaseReady();

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (!data?.session) {
            throw new Error('Не удалось получить сессию. Проверьте учетные данные.');
        }

        applySession(data.session);
        return data.session;
    }

    async function logout({ redirect = true, loginPage, returnTo } = {}) {
        await ensureSupabaseReady();

        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Ошибка при выходе из аккаунта:', error);
        } finally {
            clearSession();
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