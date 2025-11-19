const DocumentRenderer = (() => {
    const SELECTOR = '[data-documents]';
    const R2_PUBLIC_BASE = window.R2_CONFIG?.PUBLIC_URL ? window.R2_CONFIG.PUBLIC_URL.replace(/\/$/, '') : '';

    async function waitForSupabase(maxWait = 5000) {
        const start = Date.now();
        while (typeof supabase === 'undefined' || !supabase) {
            if (Date.now() - start > maxWait) {
                throw new Error('Supabase не инициализирован на странице. Проверьте подключение supabase-config.js.');
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return supabase;
    }

    function escapeHtml(text = '') {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttribute(text = '') {
        return escapeHtml(text).replace(/"/g, '&quot;');
    }

    function resolvePath(path = '', context = {}) {
        if (!path) return '';
        const segments = path.split('.');
        return segments.reduce((acc, key) => {
            if (acc && typeof acc === 'object' && key in acc) {
                return acc[key];
            }
            return '';
        }, context);
    }

    function getDisplayName(record) {
        return (record.link_text && record.link_text.trim())
            || (record.document?.file_name) 
            || (record.document?.name)
            || 'Документ';
    }

    function getDocumentUrl(record) {
        return record.document?.file_url || record.document?.url || '#';
    }

    function resolveAssetUrl(metadata = {}) {
        const directUrl = metadata.card_image_url || metadata.flag_image_url;
        if (directUrl) return directUrl;
        const key = metadata.card_image_key || metadata.flag_image_key;
        if (key && R2_PUBLIC_BASE) {
            const cleanKey = key.replace(/^\/+/, '');
            const encoded = cleanKey.split('/').map(encodeURIComponent).join('/');
            return `${R2_PUBLIC_BASE}/${encoded}`;
        }
        return '';
    }

    function renderList(container, items, options = {}) {
        const isCardMode = container.dataset.mode === 'cards';
        if (!isCardMode) {
            container.innerHTML = '';
        }
        const linkClass = options.linkClass || '';

        items.forEach((item) => {
            if (isCardMode) return;

            const li = document.createElement('li');
            const anchor = document.createElement('a');
            const url = getDocumentUrl(item);

            anchor.href = url;
            anchor.target = '_blank';
            anchor.rel = 'noopener';
            if (linkClass) anchor.classList.add(...linkClass.split(' '));

            const textSpan = document.createElement('span');
            textSpan.innerHTML = escapeHtml(getDisplayName(item));
            anchor.appendChild(textSpan);

            li.appendChild(anchor);

            if (item.usage_text) {
                const description = document.createElement('p');
                description.className = 'document-description';
                description.textContent = item.usage_text;
                li.appendChild(description);
            }

            container.appendChild(li);
        });

        if (isCardMode) {
            hydrateCards(container, items);
        }
    }

    function renderEmpty(container, message = 'Документы не найдены.') {
        container.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'doc-empty';
        li.textContent = message;
        container.appendChild(li);
    }

    function renderWithTemplate(container, items, templateId) {
        const template = document.getElementById(templateId);
        if (!template) {
            console.warn(`Шаблон с id "${templateId}" не найден. Используем стандартный вывод.`);
            renderList(container, items, { linkClass: container.dataset.linkClass || '' });
            return;
        }

        const linkClass = container.dataset.linkClass || '';
        const templateHtml = template.innerHTML;
        container.innerHTML = '';

        items.forEach((item) => {
            const url = getDocumentUrl(item);
            const context = {
                url,
                link_text: item.link_text || getDisplayName(item),
                display_name: getDisplayName(item),
                usage_text: item.usage_text || '',
                page_slug: item.page_slug,
                section: item.section,
                country: item.country,
                document: item.document || {},
                metadata: item.metadata || item.document?.metadata || {},
            };

            let html = templateHtml.replace(/{{\s*([^}]+)\s*}}/g, (_, token) => {
                const value = resolvePath(token.trim(), context);
                return escapeHtml(String(value ?? ''));
            });

            const temp = document.createElement('div');
            temp.innerHTML = html.trim();
            const fragment = document.createDocumentFragment();
            Array.from(temp.childNodes).forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (linkClass && node.matches('a')) {
                        node.classList.add(...linkClass.split(' '));
                    }
                    fragment.appendChild(node);
                }
            });
            container.appendChild(fragment);
        });
    }

    function normalizeCountryName(value = '') {
        return value ? value.trim().toLocaleLowerCase('ru-RU') : '';
    }

    function normalizeDocumentKey(record) {
        const doc = record?.document || {};
        const key = doc.file_key || doc.file_name || '';
        return key ? key.toLowerCase() : '';
    }

    function findPartnerCountryLists(container) {
        const map = new Map();
        container.querySelectorAll('.country-card[data-country]').forEach((card) => {
            const countryAttr = card.getAttribute('data-country') || card.querySelector('h3')?.textContent || '';
            const key = normalizeCountryName(countryAttr);
            if (!key) return;
            const list = card.querySelector('[data-country-list]');
            if (!list) return;
            map.set(key, { card, list });
        });
        return map;
    }

    function hydrateCards(container, items) {
        const cards = new Map();
        const orderedCards = [];
        container.querySelectorAll('[data-document-card]').forEach((card) => {
            const rawKey = card.getAttribute('data-document-card') || '';
            const key = rawKey.trim();
            orderedCards.push(card);
            if (key) {
                cards.set(key, card);
                cards.set(key.toLowerCase(), card);
            }
        });

        const takeCard = (key) => {
            if (key) {
                const trimmed = key.trim();
                if (cards.has(trimmed)) {
                    const card = cards.get(trimmed);
                    const index = orderedCards.indexOf(card);
                    if (index !== -1) orderedCards.splice(index, 1);
                    return card;
                }
                if (cards.has(trimmed.toLowerCase())) {
                    const card = cards.get(trimmed.toLowerCase());
                    const index = orderedCards.indexOf(card);
                    if (index !== -1) orderedCards.splice(index, 1);
                    return card;
                }
            }
            return orderedCards.length ? orderedCards.shift() : null;
        };

        items.forEach((item) => {
            const rawKey = item.card_key
                || item.document?.metadata?.card_key
                || item.section
                || item.document_id
                || item.id;
            const card = takeCard(rawKey ? String(rawKey) : '');
            if (!card) return;

            card.classList.remove('document-missing');
            card.removeAttribute('hidden');

            const stableKey = rawKey || item.section || item.document_id || item.id;
            if (stableKey) {
                card.setAttribute('data-document-card', String(stableKey));
            }

            const title = card.querySelector('[data-document-title]');
            if (title) {
                title.textContent = item.link_text || getDisplayName(item);
            }

            const description = card.querySelector('[data-document-description]');
            if (description) {
                if (item.usage_text) {
                    description.textContent = item.usage_text;
                    description.removeAttribute('hidden');
                } else {
                    description.textContent = '';
                    description.setAttribute('hidden', 'hidden');
                }
            }

            const action = card.querySelector('[data-document-action]');
            if (action) {
                const url = getDocumentUrl(item);
                if (url && url !== '#') {
                    action.setAttribute('href', url);
                    action.classList.remove('hidden');
                    action.removeAttribute('hidden');
                } else {
                    action.setAttribute('hidden', 'hidden');
                    action.classList.add('hidden');
                }
            }

            const image = card.querySelector('[data-document-image]');
            if (image) {
                const metadata = item.document?.metadata || {};
                const imgUrl = resolveAssetUrl(metadata);
                if (imgUrl) {
                    image.setAttribute('src', imgUrl);
                }
            }
        });
    }

    function createPartnerCard(container, countryName) {
        const displayName = (countryName || '').trim();
        if (!displayName) return null;

        const card = document.createElement('div');
        card.className = 'country-card generated-country';
        card.dataset.country = displayName;

        const title = document.createElement('h3');
        title.textContent = displayName;

        const button = document.createElement('button');
        button.className = 'toggle-btn';
        button.type = 'button';
        button.textContent = 'Список университетов';
        button.dataset.generated = 'true';
        button.addEventListener('click', () => {
            if (typeof window.toggleUniversities === 'function') {
                window.toggleUniversities(button);
            } else {
                const list = button.nextElementSibling;
                if (list) list.classList.toggle('hidden');
            }
        });

        const listWrapper = document.createElement('div');
        listWrapper.className = 'university-list hidden';

        const strong = document.createElement('strong');
        strong.textContent = `Список университетов - ${displayName}`;

        const list = document.createElement('ul');
        list.setAttribute('data-country-list', '');

        listWrapper.append(strong, list);
        card.append(title, button, listWrapper);

        const emptyState = container.querySelector('[data-empty-state]');
        if (emptyState) {
            container.insertBefore(card, emptyState);
        } else {
            container.appendChild(card);
        }

        return { card, list };
    }

    function appendPartnerRecords(container, records, markUsed) {
        if (!Array.isArray(records) || !records.length) return;

        const listsMap = findPartnerCountryLists(container);
        const emptyState = container.querySelector('[data-empty-state]');

        records.slice().forEach((record) => {
            const countryName = (record?.country || '').trim();
            if (!countryName) return;

            const normalizedCountry = normalizeCountryName(countryName);
            if (!normalizedCountry) return;

            let entry = listsMap.get(normalizedCountry);
            if (!entry) {
                entry = createPartnerCard(container, countryName);
                if (!entry) return;
                listsMap.set(normalizedCountry, entry);
            }

            const { list } = entry;
            if (!list) return;

            const documentKey = normalizeDocumentKey(record);
            const duplicate = Array.from(list.querySelectorAll('a')).some((anchor) => {
                const anchorKey = (anchor.dataset.documentKey || anchor.dataset.generatedKey || anchor.textContent || '').toLowerCase();
                return documentKey && anchorKey && anchorKey === documentKey;
            });
            if (duplicate) {
                markUsed(record);
                return;
            }

            const item = document.createElement('li');
            const anchor = document.createElement('a');
            anchor.href = getDocumentUrl(record);
            anchor.target = '_blank';
            anchor.rel = 'noopener';
            const linkText = record.link_text || getDisplayName(record);
            anchor.textContent = linkText;
            anchor.dataset.generated = 'true';
            if (record.document?.file_key) {
                anchor.dataset.documentKey = record.document.file_key;
            } else if (record.document?.file_name) {
                anchor.dataset.documentKey = record.document.file_name;
            } else if (documentKey) {
                anchor.dataset.generatedKey = documentKey;
            }
            anchor.dataset.ru = linkText;
            anchor.dataset.kz = linkText;
            anchor.dataset.en = linkText;

            item.appendChild(anchor);
            list.appendChild(item);
            markUsed(record);
        });

        if (emptyState && listsMap.size > 0) {
            emptyState.setAttribute('hidden', 'hidden');
        }
    }

    function renderPartnerCards(container, items) {
        container.innerHTML = '';
        if (!Array.isArray(items) || !items.length) {
            renderEmpty(container, 'Документы не найдены.');
            return;
        }

        const groups = new Map();
        items.forEach((item) => {
            const country = (item.country || 'Без страны').trim();
            if (!groups.has(country)) groups.set(country, []);
            groups.get(country).push(item);
        });

        const sortedCountries = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'ru'));

        sortedCountries.forEach((country) => {
            const groupItems = groups.get(country) || [];
            if (!groupItems.length) return;

            const card = document.createElement('div');
            card.className = 'country-card';

            const metadata = groupItems[0]?.document?.metadata || {};
            const flagUrl = resolveAssetUrl(metadata);

            const flag = document.createElement('img');
            flag.className = 'flag';
            flag.alt = `Флаг ${country}`;
            const resolvedFlagUrl = flagUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
            flag.src = resolvedFlagUrl;
            card.appendChild(flag);

            const title = document.createElement('h3');
            title.textContent = country;
            card.appendChild(title);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-btn';
            toggleBtn.type = 'button';
            toggleBtn.textContent = 'Список университетов';
            toggleBtn.addEventListener('click', () => {
                if (typeof window.toggleUniversities === 'function') {
                    window.toggleUniversities(toggleBtn);
                } else {
                    const list = toggleBtn.nextElementSibling;
                    if (list) list.classList.toggle('hidden');
                }
            });
            card.appendChild(toggleBtn);

            const listWrapper = document.createElement('div');
            listWrapper.className = 'university-list hidden';

            const strong = document.createElement('strong');
            strong.textContent = `Список университетов - ${country}`;
            listWrapper.appendChild(strong);

            const list = document.createElement('ul');
            groupItems
                .slice()
                .sort((a, b) => (a.link_text || a.document?.file_name || '').localeCompare(b.link_text || b.document?.file_name || '', 'ru'))
                .forEach((record) => {
                    const li = document.createElement('li');
                    const anchor = document.createElement('a');
                    anchor.href = getDocumentUrl(record);
                    anchor.target = '_blank';
                    anchor.rel = 'noopener';
                    anchor.textContent = record.link_text || getDisplayName(record);
                    li.appendChild(anchor);
                    list.appendChild(li);
                });

            listWrapper.appendChild(list);
            card.appendChild(listWrapper);
            container.appendChild(card);
        });
    }

    function hydrateContainer(container, items) {
        const hiddenClass = container.dataset.missingClass || 'document-missing';
        const hideMissing = container.dataset.hideMissing !== 'false';
        const mode = container.dataset.mode || 'hydrate';
        const isPartnersMode = mode === 'partners';
        const isCardMode = mode === 'cards';

        const registerKey = (collection, key, item) => {
            if (!key) return;
            collection.set(key, item);
            collection.set(key.toLowerCase(), item);
        };

        const map = new Map();
        const remaining = items.slice();
        const usedIds = new Set();

        const markUsed = (item) => {
            const doc = item.document || {};
            const identifier = doc.id || item.id || `${doc.file_key || doc.file_name || Math.random()}`;
            usedIds.add(identifier);
            const index = remaining.indexOf(item);
            if (index !== -1) remaining.splice(index, 1);
        };

        items.forEach((item) => {
            const doc = item.document || {};
            registerKey(map, doc.file_key || null, item);
            registerKey(map, doc.file_name || doc.name || null, item);
            if (!doc.file_key && !doc.file_name && doc.url) {
                registerKey(map, doc.url, item);
            }
        });

        const applyRecordToElement = (element, record) => {
            if (!record) return false;

            element.classList.remove(hiddenClass);
            element.classList.remove('document-missing');

            const url = getDocumentUrl(record);
            const displayName = getDisplayName(record);

            if (element.tagName === 'A') {
                element.href = url;
                element.target = '_blank';
                element.rel = 'noopener';
            }

            const targetKey = record.document?.file_key
                || record.document?.file_name
                || element.dataset.documentKey
                || '';

            element.dataset.documentKey = targetKey;

            const syncRef = element.dataset.documentRef;
            if (syncRef) {
                const selector = `[data-document-ref="${(typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(syncRef) : syncRef}"]`;
                container.querySelectorAll(selector).forEach((refElement) => {
                    refElement.dataset.documentKey = targetKey;
                });
            }

            if (element.dataset.role === 'button') {
                element.addEventListener('click', (event) => {
                    event.preventDefault();
                    window.open(url, '_blank', 'noopener');
                });
            }

            switch (element.dataset.updateText) {
                case 'link':
                    element.textContent = record.link_text || displayName;
                    break;
                case 'usage':
                    if (record.usage_text) {
                        element.textContent = record.usage_text;
                    }
                    break;
                case 'name':
                    element.textContent = displayName;
                    break;
                default:
                    if (!element.textContent.trim()) {
                        element.textContent = record.link_text || displayName;
                    }
            }

            if (element.dataset.updateHtml === 'usage' && record.usage_text) {
                element.innerHTML = escapeHtml(record.usage_text);
            }

            if (element.dataset.updateAttr) {
                const attrMap = element.dataset.updateAttr.split(',').map((pair) => pair.trim()).filter(Boolean);
                attrMap.forEach((assignment) => {
                    const [attr, token] = assignment.split(':').map((part) => part.trim());
                    if (!attr || !token) return;
                    let value = '';
                    if (token === 'url') {
                        value = url;
                    } else if (token === 'link_text') {
                        value = record.link_text || displayName;
                    } else if (token === 'usage_text') {
                        value = record.usage_text || '';
                    } else if (token.startsWith('metadata.')) {
                        value = resolvePath(token.replace(/^metadata\./, ''), record.document?.metadata || {});
                    } else if (token.startsWith('document.')) {
                        value = resolvePath(token.replace(/^document\./, ''), record.document || {});
                    } else {
                        value = (record.document && record.document[token]) || '';
                    }
                    if (value !== undefined && value !== null && value !== '') {
                        element.setAttribute(attr, value);
                    }
                });
            }

            element.removeAttribute('hidden');
            if (element.dataset.show !== 'static') {
                element.style.removeProperty('display');
            }

            markUsed(record);
            element.dataset.hydrated = 'true';
            return true;
        };

        const elements = Array.from(container.querySelectorAll('[data-document-key]'));

        elements.forEach((element) => {
            const key = element.dataset.documentKey || '';
            const record = map.get(key) || map.get(key.toLowerCase());
            if (!record) return;
            applyRecordToElement(element, record);
        });

        elements.forEach((element) => {
            if (element.dataset.hydrated === 'true') return;
            const fallback = remaining.find((item) => {
                const doc = item.document || {};
                const identifier = doc.id || item.id || `${doc.file_key || doc.file_name}`;
                return !usedIds.has(identifier);
            });
            if (!fallback) {
                element.classList.add(hiddenClass);
                if (hideMissing) element.setAttribute('hidden', 'hidden');
                return;
            }
            applyRecordToElement(element, fallback);
        });

        if (isPartnersMode && remaining.length) {
            appendPartnerRecords(container, remaining, markUsed);
        }

        if (isCardMode) {
            hydrateCards(container, items);
        }

        elements.forEach((element) => {
            if (element.dataset.hydrated === 'true') return;
            element.classList.add(hiddenClass);
            if (hideMissing) element.setAttribute('hidden', 'hidden');
        });
    }

    async function loadDocuments(container) {
        const supabaseClient = await waitForSupabase();
        const page = container.dataset.page;
        const section = container.dataset.section || null;
        const linkClass = container.dataset.linkClass || '';
        const mode = container.dataset.mode || 'list';
        const templateId = container.dataset.template || '';
        const emptyMessage = container.dataset.emptyMessage || 'Документы для этой страницы пока не добавлены.';

        if (!page) {
            renderEmpty(container, 'Не указана страница для загрузки документов.');
            return;
        }

        let query = supabaseClient
            .from('document_usages')
            .select('*, document:documents(*)')
            .eq('page_slug', page)
            .order('sort_order', { ascending: true })
            .order('updated_at', { ascending: false });

        if (section) {
            query = query.eq('section', section);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Не удалось загрузить документы для страницы', page, error);
            renderEmpty(container, 'Ошибка загрузки документов. Попробуйте позже.');
            return;
        }
 
        const filtered = (data || []).filter((item) => {
            if (!item.document) return false;
            return Boolean(item.document.file_url || item.document.url);
        });
        if (!filtered.length) {
            if (mode === 'hydrate' || mode === 'partners' || mode === 'partner-cards') {
                container.classList.add('documents-empty');
                const emptyTarget = container.dataset.emptyTarget
                    ? document.querySelector(container.dataset.emptyTarget)
                    : container.querySelector('[data-empty-state]');
                if (emptyTarget) {
                    emptyTarget.removeAttribute('hidden');
                }
            } else {
                renderEmpty(container, emptyMessage);
            }
            return;
        }

        if (mode === 'partner-cards') {
            renderPartnerCards(container, filtered);
            return;
        }

        if (mode === 'hydrate' || mode === 'partners') {
            hydrateContainer(container, filtered);
            return;
        }

        if (templateId) {
            renderWithTemplate(container, filtered, templateId);
            return;
        }

        renderList(container, filtered, { linkClass });
    }

    async function init() {
        const containers = document.querySelectorAll(SELECTOR);
        if (!containers.length) return;

        try {
            await waitForSupabase();
        } catch (error) {
            console.error(error.message);
            containers.forEach((container) => renderEmpty(container, 'Supabase недоступен.'));
            return;
        }

        containers.forEach((container) => {
            loadDocuments(container).catch((error) => {
                console.error('Ошибка загрузки документов', error);
                renderEmpty(container, 'Ошибка загрузки документов. Попробуйте позже.');
            });
        });
    }

    return { init };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DocumentRenderer.init());
} else {
    DocumentRenderer.init();
}
