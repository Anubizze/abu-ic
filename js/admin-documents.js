// Админ-панель документов - работа с Cloudflare R2 и Supabase

const R2_SETTINGS = window.R2_CONFIG || {};
const R2_ACCOUNT_ID = R2_SETTINGS.ACCOUNT_ID || '';
const R2_BUCKET = R2_SETTINGS.BUCKET || 'abu-documents';
const R2_PUBLIC_URL = R2_SETTINGS.PUBLIC_URL || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}` : '');
const R2_WORKER_URL = R2_SETTINGS.WORKER_URL || '';

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB
const SUPPORTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

const ICON_BY_TYPE = {
    pdf: 'fas fa-file-pdf',
    doc: 'fas fa-file-word',
    docx: 'fas fa-file-word',
    xls: 'fas fa-file-excel',
    xlsx: 'fas fa-file-excel',
    ppt: 'fas fa-file-powerpoint',
    pptx: 'fas fa-file-powerpoint'
};

const PAGE_TITLES = {
    '__all': 'Все страницы',
    '__unassigned': 'Без страницы',
    'index.html': 'Главная',
    'for_foreign_students.html': 'Иностранным студентам',
    'Students.html': 'Студенты',
    'Teachers.html': 'Преподаватели',
    'Our-partners.html': 'Наши партнёры',
    'international_office.html': 'Международный офис',
    'mschool.html': 'Международная школа бизнеса',
    'director.html': 'Директор школы бизнеса',
    'eramus.html': 'Кредитная мобильность',
    'erasmus+circulen.html': 'Erasmus + CirculEC',
    'academic mobility.html': 'Академическая мобильность',
    'international_cooperation.html': 'Международное сотрудничество',
    'news-detail.html': 'Новости'
};

const PARTNER_PAGE_SLUGS = new Set(['Our-partners.html', 'our-partners.html']);
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const PAGE_SECTION_DEFAULTS = {
    'mschool.html': 'certificates',
    'Our-partners.html': 'partners',
    'our-partners.html': 'partners',
    'for_foreign_students.html': 'brochure_main',
    'eramus.html': 'resources'
};

const CARD_PAGE_SLUGS = new Set(['eramus.html', 'for_foreign_students.html', 'our-partners.html']);
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const CARD_IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;

function getPageDisplayName(slug = '') {
    if (!slug) return PAGE_TITLES['__unassigned'];
    return PAGE_TITLES[slug] || slug;
}

function getPageSubtitle(slug) {
    if (slug === '__all') return 'Все документы проекта';
    if (!slug || slug === '__unassigned') return 'Документы без привязки к странице';
    return slug;
}

function escapeAttribute(value = '') {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML.replace(/"/g, '&quot;');
}

function normalizeDocumentRecord(record) {
    if (!record) return null;
    const fileName = record.file_name || record.name || record.title || '';
    const fileType = (record.file_type || record.type || '').toLowerCase();
    const fileUrl = record.file_url || record.url || '';
    return {
        ...record,
        file_name: fileName,
        file_type: fileType,
        file_url: fileUrl,
        uploaded_at: record.uploaded_at || record.created_at || null,
        page: record.page || record.page_slug || null
    };
}

function escapeHtml(value = '') {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('ru-RU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return value;
    }
}

function truncateText(text = '', limit = 160) {
    if (!text) return '';
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

class DocumentUsageAdmin {
    constructor() {
        this.state = {
            documents: [],
            usages: [],
            filteredUsages: [],
            pages: [],
            selectedPage: '__all',
            filters: {
                page: '',
                country: '',
                document: '',
                type: '',
                search: ''
            }
        };

        this.dom = {};
        this.session = null;
        this.pendingFile = null;
        this.pendingReplaceScope = 'local';
        this.pendingConfirmAction = null;
        this.currentUsageId = null;
        this.loadingCount = 0;
        this.hasPageTitleColumn = false;
        this.countriesByPage = new Map();
        this.staticDocumentsByPage = new Map();
        this.htmlPagesCatalog = Object.keys(PAGE_TITLES).filter((slug) => slug !== '__all');
        this.staticScanCompleted = false;
        this.staticScanInProgress = false;
        this.fileProtocolWarningShown = false;
        this.originalCardImage = '';
        this.cardFieldsTouched = false;

        this.init();
    }

    async init() {
        try {
            await this.waitForSupabase();
            this.session = await this.resolveSession();
            this.cacheDom();
            this.bindEvents();
            this.toggleLoading(true);
            await this.fetchAllData();
            this.toggleLoading(false);
        } catch (error) {
            console.error('Ошибка инициализации админки документов', error);
            this.toggleLoading(false);
            this.showToast('error', error.message || 'Не удалось инициализировать админку документов');
        }
    }

    async waitForSupabase(maxWait = 4000) {
        const started = Date.now();
        while (typeof supabase === 'undefined' || !supabase) {
            if (Date.now() - started > maxWait) {
                throw new Error('Supabase не инициализирован. Проверьте конфигурацию.');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async resolveSession() {
        if (window.ABU_ADMIN_AUTH && typeof window.ABU_ADMIN_AUTH.getSession === 'function') {
            const existing = await window.ABU_ADMIN_AUTH.getSession();
            if (existing) return existing;
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.warn('Не удалось получить сессию Supabase', error);
            return null;
        }
        return data?.session || null;
    }

    cacheDom() {
        this.dom.filterCountry = document.getElementById('filterCountry');
        this.dom.filterDocument = document.getElementById('filterDocument');
        this.dom.filterType = document.getElementById('filterType');
        this.dom.searchUsageText = document.getElementById('searchUsageText');
        this.dom.resetFiltersBtn = document.getElementById('resetFiltersBtn');
        this.dom.refreshUsagesBtn = document.getElementById('refreshUsagesBtn');
        this.dom.addUsageBtn = document.getElementById('addUsageBtn');
        this.dom.pagesList = document.getElementById('pagesList');
        this.dom.pageSearch = document.getElementById('pageSearch');
        this.dom.pagesCount = document.getElementById('pagesCount');
        this.dom.countryFilterGroup = document.getElementById('countryFilterGroup');

        this.dom.metricsDocuments = document.getElementById('metricsDocuments');
        this.dom.metricsUsages = document.getElementById('metricsUsages');
        this.dom.metricsFiltered = document.getElementById('metricsFiltered');
        this.dom.metaPages = document.getElementById('metaPages');
        this.dom.metaCountries = document.getElementById('metaCountries');
        this.dom.metaLastUpdate = document.getElementById('metaLastUpdate');
        this.dom.toolbarSubtitle = document.getElementById('toolbarSubtitle');

        this.dom.usagesTableBody = document.getElementById('usagesTableBody');
        this.dom.usagesTable = document.getElementById('usagesTable');

        this.dom.usageEditorModal = document.getElementById('usageEditorModal');
        this.dom.usageForm = document.getElementById('usageForm');
        this.dom.usageModalTitle = document.getElementById('usageModalTitle');
        this.dom.usageModalSubtitle = document.getElementById('usageModalSubtitle');
        this.dom.usageId = document.getElementById('usageId');
        this.dom.usagePage = document.getElementById('usagePage');
        this.dom.usageSection = document.getElementById('usageSection');
        this.dom.usageCountry = document.getElementById('usageCountry');
        this.dom.usageCountryGroup = document.getElementById('usageCountryGroup');
        this.dom.usageCountrySuggestions = document.getElementById('usageCountrySuggestions');
        this.dom.usageDocument = document.getElementById('usageDocument');
        this.dom.usageDocumentMeta = document.getElementById('usageDocumentMeta');
        this.dom.usageDocumentGroup = document.getElementById('usageDocumentGroup');
        this.dom.usageDocumentHint = document.getElementById('usageDocumentHint');
        this.dom.usageLinkText = document.getElementById('usageLinkText');
        this.dom.usageText = document.getElementById('usageText');
        this.dom.usageCardFields = document.getElementById('usageCardFields');
        this.dom.usageCardImage = document.getElementById('usageCardImage');
        this.dom.usageCardImageKey = document.getElementById('usageCardImageKey');
        this.dom.usageCardImageUpload = document.getElementById('usageCardImageUpload');
        this.dom.usageCardDescription = document.getElementById('usageCardDescription');
        this.dom.usageFileUpload = document.getElementById('usageFileUpload');
        this.dom.usageFilePreview = document.getElementById('usageFilePreview');
        this.dom.saveUsageBtn = document.getElementById('saveUsageBtn');

        this.dom.confirmModal = document.getElementById('confirmModal');
        this.dom.confirmModalTitle = document.getElementById('confirmModalTitle');
        this.dom.confirmModalMessage = document.getElementById('confirmModalMessage');
        this.dom.confirmModalBody = document.getElementById('confirmModalBody');
        this.dom.confirmModalSubmit = document.getElementById('confirmModalSubmit');

        this.dom.toastContainer = document.getElementById('toastContainer');
        this.dom.globalLoading = document.getElementById('globalLoading');
        this.dom.scrollToTopBtn = document.getElementById('scrollToTopBtn');
        this.dom.usagesTableWrapper = document.querySelector('.usages-table-wrapper');
    }

    bindEvents() {
        this.dom.filterCountry?.addEventListener('change', () => {
            this.state.filters.country = this.dom.filterCountry.value;
            this.applyFilters();
        });

        this.dom.pagesList?.addEventListener('click', (event) => {
            const item = event.target.closest('[data-page]');
            if (!item) return;
            const slug = item.getAttribute('data-page');
            this.selectPage(slug);
        });

        this.dom.pageSearch?.addEventListener('input', (event) => {
            this.filterPagesList(event.target.value || '');
        });

        this.dom.filterDocument?.addEventListener('change', () => {
            this.state.filters.document = this.dom.filterDocument.value;
            this.applyFilters();
        });

        this.dom.filterType?.addEventListener('change', () => {
            this.state.filters.type = this.dom.filterType.value;
            this.applyFilters();
        });

        this.dom.searchUsageText?.addEventListener('input', (event) => {
            this.state.filters.search = event.target.value.trim().toLowerCase();
            this.applyFilters();
        });

        this.dom.resetFiltersBtn?.addEventListener('click', () => this.resetFilters());
        this.dom.refreshUsagesBtn?.addEventListener('click', () => this.fetchAllData());

        this.dom.addUsageBtn?.addEventListener('click', () => this.openUsageModal());

        this.dom.usagesTableBody?.addEventListener('click', (event) => this.handleTableClick(event));

        this.dom.usageForm?.addEventListener('submit', (event) => this.handleUsageSubmit(event));

        this.dom.usageFilePreview?.addEventListener('click', () => this.dom.usageFileUpload?.click());
        this.dom.usageFileUpload?.addEventListener('change', (event) => this.handleFileSelection(event));

        this.dom.usagePage?.addEventListener('change', () => {
            const slug = this.dom.usagePage.value;
            const usage = this.getUsageById(this.dom.usageId?.value || '');
            this.applyPageSpecificFields(slug, usage);
        });

        this.dom.usageDocument?.addEventListener('change', () => this.handleUsageDocumentChange());

        this.dom.usageCardDescription?.addEventListener('input', () => {
            if (this.dom.usageText) {
                this.dom.usageText.value = this.dom.usageCardDescription.value;
            }
        });

        this.dom.usageCardImage?.addEventListener('input', () => {
            if (!this.dom.usageCardImage.value.trim() && this.dom.usageCardImageKey) {
                this.dom.usageCardImageKey.value = '';
            }
        });
        this.dom.usageCardImageUpload?.addEventListener('change', (event) => this.handleCardImageUpload(event));

        this.dom.usageCardImage?.addEventListener('input', () => {
            this.cardFieldsTouched = true;
        });

        this.dom.confirmModalSubmit?.addEventListener('click', () => this.executeConfirmAction());

        document.querySelectorAll('[data-close-modal]')
            .forEach((button) => button.addEventListener('click', (event) => {
                const modal = event.target.closest('.modal');
                if (modal) this.closeModal(modal);
            }));

        document.querySelectorAll('.modal').forEach((modal) => {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) this.closeModal(modal);
            });
        });

        // Кнопка "Вверх"
        this.dom.scrollToTopBtn?.addEventListener('click', () => {
            const tableWrapper = this.dom.usagesTableWrapper;
            if (tableWrapper) {
                tableWrapper.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        // Показ/скрытие кнопки "Вверх" при прокрутке
        let scrollTimeout = null;
        const handleScroll = () => {
            if (scrollTimeout) return;
            scrollTimeout = requestAnimationFrame(() => {
                const tableWrapper = this.dom.usagesTableWrapper;
                const scrollTop = tableWrapper ? tableWrapper.scrollTop : window.pageYOffset || document.documentElement.scrollTop;
                
                if (this.dom.scrollToTopBtn) {
                    if (scrollTop > 300) {
                        this.dom.scrollToTopBtn.classList.add('visible');
                    } else {
                        this.dom.scrollToTopBtn.classList.remove('visible');
                    }
                }
                scrollTimeout = null;
            });
        };

        if (this.dom.usagesTableWrapper) {
            this.dom.usagesTableWrapper.addEventListener('scroll', handleScroll, { passive: true });
        } else {
            window.addEventListener('scroll', handleScroll, { passive: true });
        }
        
        // Проверка при загрузке
        handleScroll();
    }

    async fetchAllData() {
        try {
            this.toggleLoading(true);
            this.toolbarStatus('Загрузка данных...');

            const [documents, usages] = await Promise.all([
                this.fetchDocuments(),
                this.fetchUsages()
            ]);

            this.state.documents = documents.map(normalizeDocumentRecord).filter(Boolean);
            this.state.usages = usages.map((usage) => ({
                ...usage,
                document: normalizeDocumentRecord(usage.document)
            }));
            this.hasPageTitleColumn = this.state.usages.some((usage) => typeof usage.page_title !== 'undefined');
            await this.scanStaticPages();
            this.recomputeCountryIndex();
            this.buildPagesIndex();
            this.renderPagesList();
            this.ensureSelectedPage();
            this.populateDocumentOptions();
            this.syncDependentFilters();
            this.applyFilters();
            this.updateMetrics();

            if (usages.length > 0) {
                const lastUpdate = usages.reduce((acc, item) => {
                    const current = new Date(item.updated_at || item.created_at || 0);
                    return current > acc ? current : acc;
                }, new Date(0));
                this.dom.metaLastUpdate.textContent = lastUpdate.getFullYear() > 1970 ? formatDate(lastUpdate.toISOString()) : '—';
            } else {
                this.dom.metaLastUpdate.textContent = '—';
            }

            const staticTotal = Array.from(this.staticDocumentsByPage.values()).reduce((sum, docs) => sum + docs.length, 0);
            this.toolbarStatus(`Загружено документов: ${documents.length}, вхождений: ${usages.length}, найдено статичных ссылок: ${staticTotal}`);
        } catch (error) {
            const handled = this.handleSupabaseError(error, 'загрузка данных');
            try {
                await this.scanStaticPages();
                this.buildPagesIndex();
                this.renderPagesList();
                this.ensureSelectedPage();
                this.syncDependentFilters();
                this.applyFilters();
                this.updateToolbarSubtitle();
            } catch (scanError) {
                console.warn('Не удалось проанализировать статичные страницы после ошибки Supabase', scanError);
            }
            if (!handled) {
                console.error('Ошибка загрузки данных документов', error);
                this.showToast('error', error.message || 'Не удалось загрузить данные документов');
            }
        } finally {
            this.toggleLoading(false);
        }
    }

    async fetchDocuments() {
        if (!supabase) throw new Error('Supabase не инициализирован');
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('uploaded_at', { ascending: false });

        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    async fetchUsages() {
        if (!supabase) throw new Error('Supabase не инициализирован');
        const { data, error } = await supabase
            .from('document_usages')
            .select('*, document:documents(*)')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        const usages = Array.isArray(data) ? data : [];
        return usages.map((usage) => ({
            ...usage,
            document: normalizeDocumentRecord(usage.document)
        }));
    }

    buildPagesIndex() {
        const pageMap = new Map();

        pageMap.set('__unassigned', {
            slug: '__unassigned',
            title: getPageDisplayName('__unassigned'),
            subtitle: getPageSubtitle('__unassigned'),
            count: 0,
            hasCountry: false
        });

        Object.entries(PAGE_TITLES).forEach(([slug, title]) => {
            if (slug === '__all') return;
            pageMap.set(slug, {
                slug,
                title,
                subtitle: getPageSubtitle(slug),
                count: 0,
                hasCountry: PARTNER_PAGE_SLUGS.has(slug)
            });
        });

        this.state.usages.forEach((usage) => {
            const slug = usage.page_slug && usage.page_slug.trim() ? usage.page_slug.trim() : '__unassigned';
            if (!pageMap.has(slug)) {
                pageMap.set(slug, {
                    slug,
                    title: getPageDisplayName(slug),
                    subtitle: getPageSubtitle(slug),
                    count: 0,
                    hasCountry: PARTNER_PAGE_SLUGS.has(slug)
                });
            }
            const entry = pageMap.get(slug);
            entry.count += 1;
            if (usage.country) entry.hasCountry = true;
        });

        let totalStatic = 0;
        this.staticDocumentsByPage.forEach((docs, slug) => {
            if (!docs || !docs.length) return;
            const existing = pageMap.get(slug);
            if (existing && existing.count > 0) {
                return;
            }
            if (!existing) {
                pageMap.set(slug, {
                    slug,
                    title: getPageDisplayName(slug),
                    subtitle: getPageSubtitle(slug),
                    count: 0,
                    hasCountry: PARTNER_PAGE_SLUGS.has(slug)
                });
            }
            const entry = pageMap.get(slug);
            entry.count += docs.length;
            totalStatic += docs.length;
        });

        const sortedPages = Array.from(pageMap.values())
            .filter((page) => page.slug !== '__all')
            .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
        
        const total = this.state.usages.length + totalStatic;

        this.state.pages = [
            {
                slug: '__all',
                title: getPageDisplayName('__all'),
                subtitle: getPageSubtitle('__all'),
                count: total,
                hasCountry: false
            },
            ...sortedPages
        ];
    }

    renderPagesList() {
        if (!this.dom.pagesList) return;

        if (!this.state.pages.length) {
            this.dom.pagesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>Страницы не найдены</p>
                </div>
            `;
            if (this.dom.pagesCount) this.dom.pagesCount.textContent = '0';
            return;
        }

        this.dom.pagesList.innerHTML = this.state.pages.map((page) => `
            <button class="page-item ${page.slug === this.state.selectedPage ? 'active' : ''}" data-page="${page.slug}" data-search="${escapeHtml((page.title + ' ' + (page.subtitle || '')).toLowerCase())}">
                <div class="page-title">
                    ${escapeHtml(page.title)}
                    ${page.subtitle ? `<span class="page-subtitle">${escapeHtml(page.subtitle)}</span>` : ''}
                </div>
                <span class="page-count">${page.count}</span>
            </button>
        `).join('');

        if (this.dom.pagesCount) {
            const totalPages = Math.max(this.state.pages.length - 1, 0);
            this.dom.pagesCount.textContent = String(totalPages);
        }

        if (this.dom.pageSearch && this.dom.pageSearch.value) {
            this.filterPagesList(this.dom.pageSearch.value, { preserveInput: true });
        }
    }

    highlightSelectedPageItem() {
        if (!this.dom.pagesList) return;
        const items = this.dom.pagesList.querySelectorAll('[data-page]');
        items.forEach((item) => {
            const slug = item.getAttribute('data-page');
            item.classList.toggle('active', slug === this.state.selectedPage);
        });
    }

    populateUsagePageOptions(selectedSlug = '') {
        if (!this.dom.usagePage) return;

        const seen = new Set();
        const pagesForSelect = [];

        const addPage = (slug, title) => {
            if (!slug || slug === '__all') return;
            if (seen.has(slug)) return;
            seen.add(slug);
            pagesForSelect.push({ slug, title });
        };

        addPage('__unassigned', getPageDisplayName('__unassigned'));

        Object.entries(PAGE_TITLES).forEach(([slug, title]) => addPage(slug, title));
        this.state.pages.forEach((page) => addPage(page.slug, page.title));

        const sorted = pagesForSelect.sort((a, b) => a.title.localeCompare(b.title, 'ru'));

        const options = ['<option value="">-- Выберите страницу --</option>'];
        sorted.forEach((page) => {
            options.push(`<option value="${page.slug}">${escapeHtml(page.title)}</option>`);
        });

        this.dom.usagePage.innerHTML = options.join('');
        if (selectedSlug && seen.has(selectedSlug)) {
            this.dom.usagePage.value = selectedSlug;
        } else {
            this.dom.usagePage.value = '';
        }
    }

    ensureSelectedPage() {
        const available = new Set(this.state.pages.map((page) => page.slug));
        if (!available.has(this.state.selectedPage)) {
            this.state.selectedPage = '__all';
        }
        this.highlightSelectedPageItem();
        this.updateCountryFilterVisibility();
    }

    selectPage(slug, { skipApply = false } = {}) {
        const available = new Set(this.state.pages.map((page) => page.slug));
        const nextPage = available.has(slug) ? slug : '__all';
        if (this.state.selectedPage === nextPage && !skipApply) {
            this.syncDependentFilters();
            this.applyFilters();
            return;
        }
        
        this.state.selectedPage = nextPage;
        this.state.filters.page = nextPage === '__all' ? '' : (nextPage === '__unassigned' ? '__unassigned' : nextPage);
        this.highlightSelectedPageItem();
        this.updateCountryFilterVisibility();
        this.syncDependentFilters();
        if (!skipApply) {
            this.applyFilters();
        }
    }

    filterPagesList(term = '', { preserveInput = false } = {}) {
        const value = term.toLowerCase();
        if (!preserveInput && this.dom.pageSearch) {
            this.dom.pageSearch.value = term;
        }
        if (!this.dom.pagesList) return;
        this.dom.pagesList.querySelectorAll('[data-page]').forEach((item) => {
            const haystack = item.getAttribute('data-search') || '';
            item.style.display = !value || haystack.includes(value) ? '' : 'none';
        });
    }

    refreshPagesIndex({ apply = false } = {}) {
        this.buildPagesIndex();
        this.renderPagesList();
        this.ensureSelectedPage();
        if (apply) {
            this.syncDependentFilters();
            this.applyFilters();
        }
    }

    async scanStaticPages() {
        if (this.staticScanCompleted || this.staticScanInProgress) return;
        if (!this.htmlPagesCatalog.length) return;

        if (window.location.protocol === 'file:') {
            if (!this.fileProtocolWarningShown) {
                this.showToast('info', 'Для автоматического анализа страниц запустите локальный сервер (например, python -m http.server).');
                this.fileProtocolWarningShown = true;
            }
            return;
        }
        
        this.staticScanInProgress = true;
        const staticMap = new Map();

        for (const slug of this.htmlPagesCatalog) {
            if (slug === '__unassigned') continue;
            try {
                const response = await fetch(slug, { credentials: 'same-origin' });
            if (!response.ok) {
                    console.warn('Не удалось загрузить страницу для анализа:', slug, response.status);
                    continue;
            }
            const html = await response.text();
                const docs = this.extractDocumentsFromHtml(html, slug);
                if (docs.length) {
                    staticMap.set(slug, docs);
                }
            } catch (error) {
                console.warn('Ошибка анализа страницы', slug, error);
            }
        }

        this.staticDocumentsByPage = staticMap;
        this.staticScanCompleted = true;
        this.staticScanInProgress = false;
    }

    extractDocumentsFromHtml(html, slug) {
        const results = [];
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const anchors = doc.querySelectorAll('a[href]');
            const baseUrl = new URL(slug, window.location.href);

            anchors.forEach((anchor) => {
                const href = anchor.getAttribute('href');
                if (!href || !this.isDocumentLink(href)) return;

                let absoluteUrl;
                try {
                    absoluteUrl = new URL(href, baseUrl).toString();
                } catch (error) {
                    absoluteUrl = href;
                }

                const fileName = decodeURIComponent((absoluteUrl.split('/').pop() || '').split('?')[0]);
                const type = this.getFileExtension(fileName || href);
                const text = anchor.textContent ? anchor.textContent.trim() : '';
                const contextNode = anchor.closest('li, p, div');
                const contextText = contextNode ? contextNode.textContent.trim() : text;

                results.push({
                    name: text || fileName || 'Документ',
                    fileName,
                    url: absoluteUrl,
                    type,
                    context: contextText || '',
                    linkText: text || fileName || ''
                });
            });
        } catch (error) {
            console.warn('Ошибка разбора HTML для', slug, error);
        }
        return results;
    }

    isDocumentLink(href = '') {
        const lower = href.toLowerCase();
        return DOCUMENT_EXTENSIONS.some((ext) => lower.includes(`.${ext}`));
    }

    getFileExtension(name = '') {
        const match = name.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/i);
        if (!match) return '';
        return match[1];
    }

    recomputeCountryIndex() {
        const map = new Map();
        this.state.usages.forEach((usage) => {
            const slug = usage.page_slug && usage.page_slug.trim() ? usage.page_slug.trim() : '__unassigned';
            if (!map.has(slug)) map.set(slug, new Set());
            const country = (usage.country || '').trim();
            if (country) map.get(slug).add(country);
        });
        this.countriesByPage = map;
    }

    updateCountryFilterVisibility(isPartners = PARTNER_PAGE_SLUGS.has(this.state.selectedPage)) {
        if (!this.dom.countryFilterGroup || !this.dom.filterCountry) return;
        if (isPartners) {
            this.dom.countryFilterGroup.classList.remove('hidden');
            this.dom.filterCountry.disabled = false;
        } else {
            this.dom.countryFilterGroup.classList.add('hidden');
            this.dom.filterCountry.value = '';
            this.dom.filterCountry.disabled = true;
            this.state.filters.country = '';
        }
    }

    updateToolbarSubtitle() {
        if (!this.dom.toolbarSubtitle) return;
        const page = this.state.pages.find((item) => item.slug === this.state.selectedPage);
        if (!page) {
            this.dom.toolbarSubtitle.textContent = 'Страницы не загружены';
            return;
        }

        const staticDocs = this.state.selectedPage && this.state.selectedPage !== '__all'
            ? (this.staticDocumentsByPage.get(this.state.selectedPage === '__unassigned' ? '__unassigned' : this.state.selectedPage) || [])
            : [];

        if (this.state.selectedPage === '__all') {
            this.dom.toolbarSubtitle.textContent = `Все документы · показано ${this.state.filteredUsages.length}`;
        } else if (this.state.selectedPage === '__unassigned') {
            const suffix = !this.state.filteredUsages.length && staticDocs.length
                ? ` · найдено статичных ссылок: ${staticDocs.length}`
                : '';
            this.dom.toolbarSubtitle.textContent = `Без страницы · показано ${this.state.filteredUsages.length}${suffix}`;
        } else {
            const suffix = !this.state.filteredUsages.length && staticDocs.length
                ? ` · найдено статичных ссылок: ${staticDocs.length}`
                : '';
            this.dom.toolbarSubtitle.textContent = `${page.title} · показано ${this.state.filteredUsages.length}${suffix}`;
        }
    }

    populateDocumentOptions() {
        if (!this.dom.filterDocument) return;
        const options = ['<option value="">Все документы</option>'];
        const list = [...this.state.documents].sort((a, b) => a.file_name.localeCompare(b.file_name, 'ru'));
        list.forEach((doc) => {
            options.push(`<option value="${doc.id}">${escapeHtml(doc.file_name)}</option>`);
        });
        this.dom.filterDocument.innerHTML = options.join('');

        if (this.dom.usageDocument) {
            const usageOptions = list.map((doc) => `<option value="${doc.id}">${escapeHtml(doc.file_name)}</option>`);
            this.dom.usageDocument.innerHTML = `<option value="">-- Выберите документ --</option>${usageOptions.join('')}`;
        }
    }

    syncDependentFilters() {
        const selectedPage = this.state.selectedPage;
        const countriesSelect = this.dom.filterCountry;
        const isPartners = PARTNER_PAGE_SLUGS.has(selectedPage);
        this.updateCountryFilterVisibility(isPartners);

        if (countriesSelect && isPartners) {
            const countriesSet = this.countriesByPage.get(selectedPage) || new Set();
            const countries = Array.from(countriesSet).sort((a, b) => a.localeCompare(b, 'ru'));
            this.populateSelect(countriesSelect, countries, 'Все страны');
            const hasCountries = countries.length > 0;
            countriesSelect.disabled = !hasCountries;
            if (!countries.includes(this.state.filters.country)) {
                this.state.filters.country = '';
                countriesSelect.value = '';
            }
        }
    }

    populateSelect(select, values, placeholder) {
        if (!select) return;
        const unique = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'ru'));
        const options = [`<option value="">${placeholder}</option>`];
        unique.forEach((value) => options.push(`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
        select.innerHTML = options.join('');
    }

    populateCountrySuggestions(slug, usage = null, prefill = null) {
        if (!this.dom.usageCountrySuggestions) return;

        const normalizedSlug = (slug || '').trim();
        if (!PARTNER_PAGE_SLUGS.has(normalizedSlug)) {
            this.dom.usageCountrySuggestions.innerHTML = '';
            return;
        }

        const suggestions = new Map();
        const register = (value) => {
            const trimmed = (value || '').trim();
            if (!trimmed) return;
            const lower = trimmed.toLowerCase();
            if (!suggestions.has(lower)) {
                suggestions.set(lower, trimmed);
            }
        };

        const pageCountries = this.countriesByPage.get(normalizedSlug) || new Set();
        pageCountries.forEach(register);
        register(usage?.country);
        register(prefill?.country);
        register(this.dom.usageCountry?.value);

        const values = Array.from(suggestions.values()).sort((a, b) => a.localeCompare(b, 'ru'));
        this.dom.usageCountrySuggestions.innerHTML = values
            .map((value) => `<option value="${escapeHtml(value)}"></option>`)
            .join('');
    }

    updateUsageCountryField(slug, usage = null, prefill = null) {
        if (!this.dom.usageCountryGroup || !this.dom.usageCountry) return;

        const normalizedSlug = (slug || '').trim();
        const isPartnersPage = PARTNER_PAGE_SLUGS.has(normalizedSlug);

        if (!isPartnersPage) {
            this.dom.usageCountryGroup.classList.add('hidden');
            this.dom.usageCountry.value = '';
            if (this.dom.usageCountrySuggestions) {
                this.dom.usageCountrySuggestions.innerHTML = '';
            }
            return;
        }

        this.dom.usageCountryGroup.classList.remove('hidden');

        if (!this.dom.usageCountry.value) {
            const preset = (usage?.country || prefill?.country || '').trim();
            if (preset) {
                this.dom.usageCountry.value = preset;
            }
        }

        this.populateCountrySuggestions(normalizedSlug, usage, prefill);
    }

    applyFilters() {
        const { country, document, type, search } = this.state.filters;
        const selectedPage = this.state.selectedPage;

        const filtered = this.state.usages.filter((usage) => {
            if (selectedPage === '__unassigned') {
                if (usage.page_slug) return false;
            } else if (selectedPage !== '__all') {
                if (usage.page_slug !== selectedPage) return false;
            }

            if (country && (usage.country || '') !== country) return false;
            if (document && usage.document_id !== document) return false;
            if (type && (usage.document?.file_type || '').toLowerCase() !== type.toLowerCase()) return false;

            if (search) {
                const haystack = [
                    usage.page_slug,
                    usage.page_title,
                    usage.section,
                    usage.country,
                    usage.usage_text,
                    usage.link_text,
                    usage.document?.file_name
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }

            return true;
        });

        this.state.filteredUsages = filtered;
        this.renderUsagesTable();
        this.updateMetrics();
        this.updateToolbarSubtitle();
    }

    renderUsagesTable() {
        if (!this.dom.usagesTableBody) return;

        if (this.state.filteredUsages.length === 0) {
            if (!this.renderStaticDocumentsFallback()) {
                this.dom.usagesTableBody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="8">
                            <div class="empty-state">
                                <i class="fas fa-folder-open"></i>
                                <p>Вхождения не найдены. Измените фильтры или создайте новое вхождение.</p>
                </div>
                        </td>
                    </tr>
            `;
            }
            return;
        }

        const rows = this.state.filteredUsages.map((usage) => {
            const doc = usage.document || {};
            const iconClass = ICON_BY_TYPE[(doc.file_type || '').toLowerCase()] || 'fas fa-file';
            const usageText = usage.usage_text ? truncateText(usage.usage_text) : '<span class="usage-text muted">Текст не указан</span>';
            const countryText = usage.country || '—';
            const sectionText = usage.section || '—';
            const documentLink = doc.file_url ? `<a href="${doc.file_url}" target="_blank" rel="noopener">${escapeHtml(doc.file_name || 'Открыть')}</a>` : '<span class="usage-text muted">Нет ссылки</span>';
            const updatedAt = usage.updated_at || usage.created_at;
            
            return `
                <tr data-usage-id="${usage.id}">
                    <td><code>${usage.id.slice(0, 8)}…</code></td>
                    <td>${escapeHtml(usage.page_title || usage.page_slug || '—')}</td>
                    <td>${escapeHtml(sectionText)}</td>
                    <td>${escapeHtml(countryText)}</td>
                    <td>
                        <div class="document-cell">
                            <i class="${iconClass}"></i>
                            <div>
                                <strong>${escapeHtml(doc.file_name || 'Документ')}</strong><br>
                                <small>${documentLink}</small>
                    </div>
                    </div>
                    </td>
                    <td>${usageText}</td>
                    <td>${formatDate(updatedAt)}</td>
                    <td>
                        <div class="usage-actions">
                            <button class="btn-icon" data-action="open-document" title="Открыть документ" data-usage-id="${usage.id}">
                                <i class="fas fa-external-link-alt"></i>
                            </button>
                            <button class="btn-icon" data-action="edit" title="Редактировать" data-usage-id="${usage.id}">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn-icon" data-action="replace" title="Заменить файл" data-usage-id="${usage.id}">
                                <i class="fas fa-retweet"></i>
                            </button>
                            <button class="btn-icon danger" data-action="delete" title="Удалить" data-usage-id="${usage.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                </div>
                    </td>
                </tr>
            `;
        });

        this.dom.usagesTableBody.innerHTML = rows.join('');
    }

    renderStaticDocumentsFallback() {
        if (!this.dom.usagesTableBody) return false;
        const selectedPage = this.state.selectedPage;
        if (!selectedPage || selectedPage === '__all') return false;

        const key = selectedPage === '__unassigned' ? '__unassigned' : selectedPage;
        const docs = this.staticDocumentsByPage.get(key) || [];
        if (!docs.length) return false;

        const displayName = getPageDisplayName(key);

        const defaultSection = PAGE_SECTION_DEFAULTS[key] || '';
        this.dom.usagesTableBody.innerHTML = docs.map((doc) => {
            const iconClass = ICON_BY_TYPE[doc.type] || 'fas fa-file';
            const encodedName = encodeURIComponent(doc.name || doc.fileName || 'Документ');
            const encodedUrl = encodeURIComponent(doc.url || '');
            const encodedText = encodeURIComponent(doc.linkText || doc.name || '');
            const encodedContext = encodeURIComponent(doc.context || '');
            return `
                <tr class="static-row">
                    <td><span class="badge badge-static">Статика</span></td>
                    <td>${escapeHtml(displayName)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>
                        <div class="document-name-cell">
                            <i class="${iconClass}"></i>
                            <div class="document-name-info">
                                <strong>${escapeHtml(doc.name || doc.fileName || 'Документ')}</strong>
                                <small class="document-filename">${escapeHtml(doc.fileName || '')}</small>
                                <small><a href="${escapeAttribute(doc.url)}" target="_blank" rel="noopener">Открыть</a></small>
                            </div>
                        </div>
                    </td>
                    <td>${doc.context ? escapeHtml(truncateText(doc.context, 200)) : '<span class="usage-text muted">Текст не найден</span>'}</td>
                    <td>—</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-sm btn-primary" data-action="attach-static" data-page="${key}" data-section="${escapeAttribute(defaultSection)}" data-name="${encodedName}" data-url="${encodedUrl}" data-text="${encodedText}" data-context="${encodedContext}">
                                <i class="fas fa-link"></i>
                                Заменить
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        return true;
    }

    updateMetrics() {
        const uniqueCountries = new Set();
        this.countriesByPage.forEach((set) => set.forEach((country) => uniqueCountries.add(country)));
        const usageCounts = new Map();
        this.state.usages.forEach((usage) => {
            const slug = usage.page_slug && usage.page_slug.trim() ? usage.page_slug.trim() : '__unassigned';
            usageCounts.set(slug, (usageCounts.get(slug) || 0) + 1);
        });

        const staticTotal = Array.from(this.staticDocumentsByPage.entries()).reduce((sum, [slug, docs]) => {
            if (!docs || !docs.length) return sum;
            const normalized = slug || '__unassigned';
            if ((usageCounts.get(normalized) || 0) > 0) return sum;
            return sum + docs.length;
        }, 0);

        if (this.dom.metricsDocuments) this.dom.metricsDocuments.textContent = this.state.documents.length.toString();
        if (this.dom.metricsUsages) this.dom.metricsUsages.textContent = (this.state.usages.length + staticTotal).toString();
        if (this.dom.metricsFiltered) this.dom.metricsFiltered.textContent = this.state.filteredUsages.length.toString();
        if (this.dom.metaPages) this.dom.metaPages.textContent = Math.max(this.state.pages.length - 1, 0).toString();
        if (this.dom.metaCountries) this.dom.metaCountries.textContent = uniqueCountries.size.toString();
    }

    toolbarStatus(text) {
        if (this.dom.toolbarSubtitle) {
            this.dom.toolbarSubtitle.textContent = text;
        }
    }

    handleTableClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const usageId = button.getAttribute('data-usage-id');
        const action = button.getAttribute('data-action');
        let usage = null;
        if (action !== 'attach-static') {
            usage = this.state.usages.find((item) => item.id === usageId);
            if (!usage) {
                this.showToast('error', 'Вхождение не найдено');
                return;
            }
        }

        switch (action) {
            case 'open-document':
                if (usage.document?.file_url) {
                    window.open(usage.document.file_url, '_blank', 'noopener');
            } else {
                    this.showToast('error', 'Ссылка на документ отсутствует');
                }
                break;
            case 'edit':
                this.openUsageModal(usageId);
                break;
            case 'replace':
                this.openUsageModal(usageId, { focusFile: true });
                break;
            case 'delete':
                this.promptDeleteUsage(usageId);
                break;
            case 'attach-static': {
                const pageSlug = button.dataset.page || '';
                const section = button.dataset.section || (PAGE_SECTION_DEFAULTS[pageSlug] || '');
                const docName = button.dataset.name ? decodeURIComponent(button.dataset.name) : '';
                const docUrl = button.dataset.url ? decodeURIComponent(button.dataset.url) : '';
                const linkText = button.dataset.text ? decodeURIComponent(button.dataset.text) : docName;
                const context = button.dataset.context ? decodeURIComponent(button.dataset.context) : '';
                this.openUsageModal(null, {
                    focusFile: true,
                    prefill: {
                        pageSlug,
                        section,
                        displayName: docName,
                        linkText,
                        context,
                        originalUrl: docUrl
                    }
                });
                break;
            }
            default:
                break;
        }
    }

    getUsageById(id) {
        if (!id) return null;
        return this.state.usages.find((item) => item.id === id) || null;
    }

    isCardPage(slug) {
        if (typeof slug !== 'string') return false;
        return CARD_PAGE_SLUGS.has(slug.toLowerCase());
    }

    applyPageSpecificFields(slug, usage = null, prefill = null) {
        this.updateUsageCountryField(slug, usage, prefill);

        if (!this.dom.usageCardFields) return;
        const isCardPage = this.isCardPage(slug);

        if (!isCardPage) {
            this.dom.usageCardFields.classList.add('hidden');
            if (this.dom.usageCardImage) this.dom.usageCardImage.value = '';
            if (this.dom.usageCardImageKey) this.dom.usageCardImageKey.value = '';
            if (this.dom.usageCardDescription) this.dom.usageCardDescription.value = '';
            if (this.dom.usageText && usage?.usage_text) {
                this.dom.usageText.value = usage.usage_text;
            }
            this.cardFieldsTouched = false;
            this.originalCardImage = '';
            return;
        }

        this.dom.usageCardFields.classList.remove('hidden');

        const description = usage?.usage_text || this.dom.usageText?.value || '';
        if (this.dom.usageCardDescription) this.dom.usageCardDescription.value = description;
        if (this.dom.usageText) this.dom.usageText.value = description;

        let documentId = usage?.document_id || '';
        if (!documentId && this.dom.usageDocument) {
            documentId = this.dom.usageDocument.value || '';
        }
        const doc = documentId ? this.state.documents.find((item) => item.id === documentId) : usage?.document || null;
        const cardImage = doc?.metadata?.card_image_url || '';
        const cardImageKey = doc?.metadata?.card_image_key || '';
        this.originalCardImage = cardImage;
        this.cardFieldsTouched = false;
        if (this.dom.usageCardImage) this.dom.usageCardImage.value = cardImage;
        if (this.dom.usageCardImageKey) this.dom.usageCardImageKey.value = cardImageKey;
    }

    handleUsageDocumentChange() {
        if (!this.dom.usagePage) return;
        const slug = this.dom.usagePage.value || '';
        if (!this.isCardPage(slug)) return;
        if (!this.dom.usageCardImage) return;
        if (this.cardFieldsTouched) return;
        const documentId = this.dom.usageDocument?.value || '';
        if (!documentId) return;
        const doc = this.state.documents.find((item) => item.id === documentId);
        const cardImage = doc?.metadata?.card_image_url || '';
        const cardImageKey = doc?.metadata?.card_image_key || '';
        this.originalCardImage = cardImage;
        this.dom.usageCardImage.value = cardImage;
        if (this.dom.usageCardImageKey) this.dom.usageCardImageKey.value = cardImageKey;
    }

    openUsageModal(usageId = null, options = {}) {
        this.currentUsageId = usageId;
        this.pendingFile = null;
        this.pendingReplaceScope = 'local';
        this.pendingConfirmAction = null;
        this.currentUsageId = null;
        this.loadingCount = 0;
        this.hasPageTitleColumn = false;
        this.countriesByPage = new Map();
        this.staticDocumentsByPage = new Map();
        this.htmlPagesCatalog = Object.keys(PAGE_TITLES).filter((slug) => slug !== '__all');
        this.staticScanCompleted = false;
        this.staticScanInProgress = false;
        this.fileProtocolWarningShown = false;

        this.recomputeCountryIndex();
        this.updateFilePreview();

        const usage = usageId ? this.state.usages.find((item) => item.id === usageId) : null;
        const isNew = !usage;
        const prefill = options?.prefill || null;

        if (isNew) {
            this.dom.usageModalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Новое вхождение';
            if (prefill && prefill.displayName) {
                const safeUrl = prefill.originalUrl ? escapeAttribute(prefill.originalUrl) : '#';
                this.dom.usageModalSubtitle.innerHTML = `Документ на странице: <a href="${safeUrl}" target="_blank" rel="noopener">${escapeHtml(prefill.displayName)}</a>`;
            } else {
                this.dom.usageModalSubtitle.textContent = 'Создайте привязку документа к странице';
            }
        } else {
            const docName = usage.document?.file_name || 'Документ';
            this.dom.usageModalTitle.innerHTML = `<i class="fas fa-pen-to-square"></i> Вхождение ${usage.id.slice(0, 8)}…`;
            this.dom.usageModalSubtitle.textContent = `Документ: ${docName}`;
        }

        this.dom.usageId.value = usage?.id || '';
        const existingSlug = usage?.page_slug && usage.page_slug.trim() ? usage.page_slug.trim() : (usage ? '__unassigned' : '');
        const preselectedPage = (!usage && this.state.selectedPage && this.state.selectedPage !== '__all' && this.state.selectedPage !== '__unassigned')
            ? this.state.selectedPage
            : '';
        const targetSlug = prefill?.pageSlug || existingSlug || preselectedPage;
        this.populateUsagePageOptions(targetSlug);
        const defaultSection = targetSlug ? PAGE_SECTION_DEFAULTS[targetSlug] : null;
        this.dom.usageSection.value = usage?.section || prefill?.section || defaultSection || '';
        if (this.dom.usageCountry) {
            this.dom.usageCountry.value = usage?.country || prefill?.country || '';
        }
        this.dom.usageLinkText.value = (usage?.link_text || prefill?.linkText || '');
        this.dom.usageText.value = usage?.usage_text || prefill?.context || '';
        if (this.dom.usageCardDescription) {
            this.dom.usageCardDescription.value = usage?.usage_text || prefill?.context || '';
        }
        if (this.dom.usageCardImage) {
            const docMeta = usage?.document?.metadata || {};
            this.dom.usageCardImage.value = docMeta.card_image_url || '';
            if (this.dom.usageCardImageKey) this.dom.usageCardImageKey.value = docMeta.card_image_key || '';
            this.originalCardImage = docMeta.card_image_url || '';
            this.cardFieldsTouched = false;
        }

        if (isNew) {
            this.toggleDocumentSelector(false, 'Загрузите файл — документ будет создан автоматически.');
            this.renderDocumentMeta(null);
            this.dom.usageDocumentMeta?.classList.add('hidden');
        } else {
            this.toggleDocumentSelector(true);
            if (this.dom.usageDocument) {
                this.dom.usageDocument.value = usage?.document_id || '';
            }
            this.renderDocumentMeta(usage?.document || null);
            this.dom.usageDocumentMeta?.classList.remove('hidden');
        }
        if (!isNew) {
            this.renderDocumentMeta(usage?.document || null);
        }

        if (options.focusFile && this.dom.usageFilePreview) {
            setTimeout(() => this.dom.usageFilePreview?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }

        this.applyPageSpecificFields(targetSlug, usage, prefill);
        this.openModal(this.dom.usageEditorModal);
    }

    renderDocumentMeta(doc) {
        if (!this.dom.usageDocumentMeta) return;
        if (!doc) {
            this.dom.usageDocumentMeta.classList.add('hidden');
            this.dom.usageDocumentMeta.querySelector('[data-doc-prop="file_name"]').textContent = '—';
            this.dom.usageDocumentMeta.querySelector('[data-doc-prop="file_type"]').textContent = '';
            const linkEl = this.dom.usageDocumentMeta.querySelector('[data-doc-prop="file_url"]');
            linkEl.setAttribute('href', '#');
            linkEl.textContent = '—';
            return;
        }

        this.dom.usageDocumentMeta.classList.remove('hidden');
        this.dom.usageDocumentMeta.querySelector('[data-doc-prop="file_name"]').textContent = doc.file_name || '—';
        this.dom.usageDocumentMeta.querySelector('[data-doc-prop="file_type"]').textContent = (doc.file_type || doc.type || '').toUpperCase();
        const linkEl = this.dom.usageDocumentMeta.querySelector('[data-doc-prop="file_url"]');
        linkEl.setAttribute('href', doc.file_url || '#');
        linkEl.textContent = doc.file_url ? 'Открыть' : '—';
    }

    handleFileSelection(event) {
        const file = event.target.files?.[0];
        if (!file) {
            this.pendingFile = null;
            this.updateFilePreview();
            return;
        }

        if (file.size > FILE_SIZE_LIMIT) {
            this.showToast('error', 'Размер файла превышает 50 МБ');
            event.target.value = '';
            return;
        }

        const extension = (file.name.split('.').pop() || '').toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            this.showToast('error', 'Поддерживаются только PDF, DOC(X), XLS(X), PPT(X)');
            event.target.value = '';
            return;
        }

        this.pendingFile = file;
        this.pendingReplaceScope = 'local';
        this.updateFilePreview();
        this.showToast('info', 'Файл выбран. Не забудьте сохранить изменения.');
    }

    updateFilePreview() {
        if (!this.dom.usageFilePreview) return;
        if (!this.pendingFile) {
            this.dom.usageFilePreview.innerHTML = `
                <i class="fas fa-file-upload"></i>
                <span>Выберите файл, чтобы заменить</span>
                <small>PDF, DOC(X), XLS(X), PPT(X) · до 50 МБ</small>
            `;
            return;
        }

        const sizeMb = (this.pendingFile.size / (1024 * 1024)).toFixed(2);
        const ext = this.pendingFile.name.split('.').pop();
        this.dom.usageFilePreview.innerHTML = `
            <div class="file-summary">
                <strong>${escapeHtml(this.pendingFile.name)}</strong>
                <span>${ext?.toUpperCase()} · ${sizeMb} МБ</span>
                <em>Замена (${this.pendingReplaceScope === 'global' ? 'глобально' : 'только здесь'})</em>
            </div>
        `;
    }

    async handleUsageSubmit(event) {
        event.preventDefault();

        const usageId = this.dom.usageId.value || null;
        const isNew = !usageId;
        const selectedDocumentId = this.dom.usageDocument.value || null;
        const pageValue = this.dom.usagePage.value;
        const normalizedPage = pageValue === '__unassigned' ? null : (pageValue || null);
        const isCardPage = this.isCardPage(pageValue);
        const cardImageUrl = this.dom.usageCardImage ? this.dom.usageCardImage.value.trim() : '';
        const cardImageKey = this.dom.usageCardImageKey ? this.dom.usageCardImageKey.value.trim() : '';
        const descriptionValue = isCardPage
            ? (this.dom.usageCardDescription ? this.dom.usageCardDescription.value.trim() : '')
            : (this.dom.usageText?.value?.trim() || '');

        if (!pageValue) {
            this.showToast('error', 'Укажите страницу, на которой размещается документ');
            return;
        }

        if (!selectedDocumentId && !this.pendingFile) {
            this.showToast('error', 'Выберите документ или загрузите новый файл');
            return;
        }

        if (!this.pendingFile && !selectedDocumentId) {
            this.showToast('error', 'Документ не выбран');
            return;
        }

        try {
            this.toggleLoading(true);

            let documentId = selectedDocumentId;
            let replacementSummary = null;

            if (this.pendingFile) {
                replacementSummary = await this.performReplacement({ usageId, cardImageUrl, cardImageKey });
                documentId = replacementSummary?.documentId || documentId;
            }

            const payload = {
                page_slug: normalizedPage,
                section: this.dom.usageSection.value && this.dom.usageSection.value.trim()
                    ? this.dom.usageSection.value.trim()
                    : (normalizedPage ? PAGE_SECTION_DEFAULTS[normalizedPage] || null : null),
                country: this.dom.usageCountry.value.trim() || null,
                usage_text: this.dom.usageText.value.trim() || null,
                link_text: this.dom.usageLinkText.value.trim() || null,
                document_id: documentId
            };

            if (this.dom.usageText) {
                this.dom.usageText.value = descriptionValue;
            }
            payload.usage_text = descriptionValue ? descriptionValue : null;

            if (this.hasPageTitleColumn) {
                payload.page_title = normalizedPage ? getPageDisplayName(normalizedPage) : null;
            }

            let updatedUsage = null;

            if (isNew) {
                const { data, error } = await supabase
                    .from('document_usages')
                    .insert([payload])
                    .select('*, document:documents(*)')
                    .single();

                if (error) {
                    this.handleSupabaseError(error, 'создание вхождения');
                    throw error;
                }
                updatedUsage = {
                    ...data,
                    document: normalizeDocumentRecord(data.document)
                };
                this.state.usages.unshift(updatedUsage);
                this.showToast('success', 'Новое вхождение добавлено');
                } else {
                const { data, error } = await supabase
                    .from('document_usages')
                    .update(payload)
                    .eq('id', usageId)
                    .select('*, document:documents(*)')
                    .single();

                if (error) {
                    this.handleSupabaseError(error, 'обновление вхождения');
                    throw error;
                }
                updatedUsage = {
                    ...data,
                    document: normalizeDocumentRecord(data.document)
                };
                this.state.usages = this.state.usages.map((usage) => usage.id === usageId ? updatedUsage : usage);
                this.showToast('success', 'Изменения сохранены');
            }

            if (replacementSummary?.message) {
                this.showToast('info', replacementSummary.message);
            }

            if (documentId && isCardPage) {
                const metadataPatch = {
                    card_image_url: cardImageUrl || null,
                    card_image_key: cardImageKey || null
                };
                const refreshedDocument = await this.updateDocumentMetadata(documentId, metadataPatch);
                if (refreshedDocument) {
                    updatedUsage.document = normalizeDocumentRecord(refreshedDocument);
                    if (this.dom.usageCardImageKey) {
                        this.dom.usageCardImageKey.value = refreshedDocument.metadata?.card_image_key || '';
                    }
                }
                this.originalCardImage = cardImageUrl || '';
                this.cardFieldsTouched = false;
            }

            this.state.usages = this.state.usages.map((usage) => usage.id === updatedUsage.id ? updatedUsage : usage);

            this.pendingFile = null;
            this.pendingReplaceScope = 'local';
            this.dom.usageFileUpload.value = '';
            this.updateFilePreview();
            this.dom.usagePage.value = '';

            this.recomputeCountryIndex();
            this.refreshPagesIndex();
            this.populateDocumentOptions();
            this.syncDependentFilters();
            this.applyFilters();

            this.closeModal(this.dom.usageEditorModal);
        } catch (error) {
            if (!this.handleSupabaseError(error, 'сохранение вхождения')) {
                console.error('Ошибка сохранения вхождения', error);
                this.showToast('error', error.message || 'Не удалось сохранить изменения');
            }
        } finally {
            this.toggleLoading(false);
        }
    }

    async performReplacement({ usageId, cardImageUrl = '', cardImageKey = '' }) {
        const file = this.pendingFile;
        if (!file) return null;

        if (!R2_WORKER_URL) {
            throw new Error('WORKER_URL не задан. Укажите адрес Cloudflare Worker в js/r2-config.js.');
        }

        const existingUsage = usageId ? this.state.usages.find((item) => item.id === usageId) : null;
        const oldDocument = existingUsage?.document || null;

        const uploadMeta = await this.uploadFileToR2(file, oldDocument);
        const newDocument = await this.createDocumentRecord(uploadMeta, oldDocument, {
            card_image_url: cardImageUrl || null,
            card_image_key: cardImageKey || null
        });

        if (!this.state.documents.some((doc) => doc.id === newDocument.id)) {
            this.state.documents = [newDocument, ...this.state.documents];
        }

        if (usageId) {
            const { data, error } = await supabase
                .from('document_usages')
                .update({ document_id: newDocument.id })
                .eq('id', usageId)
                .select('*, document:documents(*)')
                .single();

            if (error) {
                this.handleSupabaseError(error, 'замена документа');
                throw error;
            }

            const normalizedUsage = {
                ...data,
                document: normalizeDocumentRecord(data.document)
            };

            this.state.usages = this.state.usages.map((usage) => usage.id === usageId ? normalizedUsage : usage);

            await this.logDocumentEvent({
                event_type: 'local_replace',
                document_id: newDocument.id,
                previous_document_id: oldDocument?.id || null,
                affected_usage_ids: [usageId],
                payload: {
                    old_file: oldDocument?.file_url,
                    new_file: newDocument.file_url,
                    scope: 'local'
                }
            });
        }

        return {
            documentId: newDocument.id,
            message: 'Документ заменён для выбранного вхождения'
        };
    }

    async uploadFileToR2(file, previousDocument = null) {
        const fileName = file.name;
        const response = await fetch(`${R2_WORKER_URL}/upload?name=${encodeURIComponent(fileName)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Не удалось загрузить файл: ${response.status} ${errorText}`);
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            console.warn('Ответ Cloudflare Worker не в формате JSON. Будет использован публичный URL по умолчанию.', error);
        }

        const fileUrl = payload?.url || `${(R2_PUBLIC_URL || '').replace(/\/$/, '')}/${encodeURIComponent(fileName)}`;
        const extension = (file.name.split('.').pop() || '').toLowerCase();

        let fileKey = payload?.key || payload?.file_key || '';
        if (!fileKey && fileUrl) {
            try {
                const url = new URL(fileUrl);
                fileKey = decodeURIComponent(url.pathname.replace(/^\//, ''));
            } catch (error) {
                fileKey = '';
            }
        }
        if (!fileKey) {
            fileKey = previousDocument?.file_key || fileName;
        }

        return {
            file_key: fileKey,
            file_url: fileUrl,
            file_name: file.name,
            file_type: extension,
            file_size: file.size,
            version: previousDocument ? (previousDocument.version || 1) + 1 : 1
        };
    }

    async createDocumentRecord(meta, previousDocument = null, extraMetadata = {}) {
        const baseMetadata = { ...(previousDocument?.metadata || {}) };
        const mergedMetadata = {
            ...baseMetadata,
            ...extraMetadata
        };
        if (!mergedMetadata.source) {
            mergedMetadata.source = baseMetadata.source || 'uploaded';
        }
        Object.keys(mergedMetadata).forEach((key) => {
            const value = mergedMetadata[key];
            if (value === null || value === '' || typeof value === 'undefined') {
                delete mergedMetadata[key];
            }
        });

        const fileKeyFallback = previousDocument?.file_key || meta.file_key || meta.file_name;
        const payload = {
            file_key: meta.file_key || fileKeyFallback,
            file_url: meta.file_url,
            file_name: meta.file_name,
            file_type: meta.file_type,
            file_size: meta.file_size ?? null,
            version: meta.version ?? (previousDocument ? (previousDocument.version || 1) + 1 : 1),
            is_active: true,
            metadata: mergedMetadata,
            title: previousDocument?.title || meta.file_name
        };

        const upsert = await supabase
            .from('documents')
            .insert([payload])
            .select('*')
            .single();

        if (upsert.error) {
            const duplicateErrorCodes = new Set(['23505', 'PGRST302', 'PGRST303', '409', 409]);
            const isDuplicate =
                duplicateErrorCodes.has(upsert.error.code) ||
                (typeof upsert.error.hint === 'string' && upsert.error.hint.toLowerCase().includes('duplicate')) ||
                (typeof upsert.error.message === 'string' && upsert.error.message.toLowerCase().includes('duplicate'));

            if (isDuplicate) {
                const messageText = (upsert.error.message || '').toLowerCase();
                const isFileUrlConflict = messageText.includes('file_url');

                const resolveExistingByKey = async () => {
                    const { data, error } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('file_key', fileKeyFallback)
                    .maybeSingle();
                    if (error) throw error;
                    return data;
                };

                const resolveExistingByUrl = async () => {
                    const { data, error } = await supabase
                        .from('documents')
                        .select('*')
                        .eq('file_url', meta.file_url)
                        .maybeSingle();
                    if (error) throw error;
                    return data;
                };

                let existing = null;
                if (!isFileUrlConflict) {
                    existing = await resolveExistingByKey();
                }
                if (!existing) {
                    existing = await resolveExistingByUrl();
                }

                if (existing) {
                    const updatePayload = {
                        file_url: meta.file_url,
                        file_name: meta.file_name,
                        file_type: meta.file_type,
                        file_size: meta.file_size ?? null,
                        version: (existing.version || 1) + 1,
                        metadata: mergedMetadata,
                        is_active: true,
                        title: existing.title || previousDocument?.title || meta.file_name
                    };

                    const { data: updated, error: updateError } = await supabase
                        .from('documents')
                        .update(updatePayload)
                        .eq('id', existing.id)
                        .select('*')
                        .single();

                    if (updateError) throw updateError;
                    return normalizeDocumentRecord(updated);
                }
            }
            throw upsert.error;
        }

        return normalizeDocumentRecord(upsert.data);
    }

    async updateDocumentMetadata(documentId, patch = {}) {
        if (!documentId) return null;
        const target = this.state.documents.find((doc) => doc.id === documentId);
        if (!target) return null;

        const nextMetadata = { ...(target.metadata || {}) };
        let changed = false;
        Object.entries(patch).forEach(([key, value]) => {
            const normalized = value === '' || value === null || typeof value === 'undefined' ? null : value;
            if (normalized === null) {
                if (key in nextMetadata) {
                    delete nextMetadata[key];
                    changed = true;
                }
            } else if (nextMetadata[key] !== normalized) {
                nextMetadata[key] = normalized;
                changed = true;
            }
        });
        if (!changed) return target;

        const { data, error } = await supabase
            .from('documents')
            .update({ metadata: nextMetadata })
            .eq('id', documentId)
            .select('*')
            .single();

        if (error) {
            this.handleSupabaseError(error, 'обновление документа');
            throw error;
        }

        const normalized = normalizeDocumentRecord(data);
        this.state.documents = this.state.documents.map((doc) => doc.id === documentId ? normalized : doc);
        this.state.usages = this.state.usages.map((usage) => usage.document_id === documentId
            ? { ...usage, document: normalized }
            : usage);
        return normalized;
    }

    async uploadAssetToR2(file, { prefix = '' } = {}) {
        if (!R2_WORKER_URL) {
            throw new Error('WORKER_URL не задан. Укажите адрес Cloudflare Worker в js/r2-config.js.');
        }

        const extension = (file.name.split('.').pop() || '').toLowerCase();
        if (!SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
            throw new Error('Поддерживаются только JPG, PNG или WEBP изображения');
        }

        if (file.size > CARD_IMAGE_SIZE_LIMIT) {
            throw new Error('Размер изображения превышает 5 МБ');
        }

        const safePrefix = prefix ? prefix.replace(/\\/g, '/').replace(/\s+/g, '-') : '';
        const sanitizedName = file.name.replace(/\s+/g, '-');
        const uniqueName = `${Date.now()}-${sanitizedName}`;
        const key = safePrefix ? `${safePrefix.replace(/\/+$/, '')}/${uniqueName}` : uniqueName;

        const response = await fetch(`${R2_WORKER_URL}/upload?name=${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Не удалось загрузить изображение: ${response.status} ${errorText}`);
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            // fallback handled below
        }

        const fileUrl = payload?.url || `${(R2_PUBLIC_URL || '').replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;

        return {
            file_key: key,
            file_url: fileUrl
        };
    }

    async handleCardImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const slug = this.dom.usagePage?.value || '';
        if (!this.isCardPage(slug)) {
            this.showToast('error', 'Изображения можно загружать только для карточек.');
            event.target.value = '';
            return;
        }

        this.toggleLoading(true);
        try {
            const prefix = `img/${(slug || 'general').toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
            const asset = await this.uploadAssetToR2(file, { prefix });
            if (this.dom.usageCardImage) {
                this.dom.usageCardImage.value = asset.file_url;
            }
            if (this.dom.usageCardImageKey) {
                this.dom.usageCardImageKey.value = asset.file_key;
            }
            this.cardFieldsTouched = true;
            this.showToast('success', 'Изображение загружено');
        } catch (error) {
            console.error('Ошибка загрузки изображения карточки', error);
            this.showToast('error', error.message || 'Не удалось загрузить изображение');
        } finally {
            event.target.value = '';
            this.toggleLoading(false);
        }
    }

    promptDeleteUsage(usageId = this.currentUsageId) {
        const usage = usageId ? this.state.usages.find((item) => item.id === usageId) : null;
        if (!usage) {
            this.showToast('error', 'Вхождение не найдено');
            return;
        }

        this.pendingConfirmAction = async () => {
            await this.deleteUsage(usageId);
            this.closeModal(this.dom.confirmModal);
            this.closeModal(this.dom.usageEditorModal);
        };

        this.dom.confirmModalTitle.innerHTML = '<i class="fas fa-trash"></i> Удалить вхождение?';
        this.dom.confirmModalMessage.textContent = '';
        this.dom.confirmModalBody.innerHTML = `
            <p>Страница: <strong>${escapeHtml(usage.page_title || usage.page_slug || '')}</strong></p>
            <p>Документ: <strong>${escapeHtml(usage.document?.file_name || '')}</strong></p>
            <p>Действие нельзя отменить.</p>
        `;
        this.openModal(this.dom.confirmModal);
    }

    async deleteUsage(usageId) {
        try {
            this.toggleLoading(true);
            const { error } = await supabase
                .from('document_usages')
                .delete()
                .eq('id', usageId);
            if (error) {
                this.handleSupabaseError(error, 'удаление вхождения');
                throw error;
            }

            this.state.usages = this.state.usages.filter((usage) => usage.id !== usageId);
            this.recomputeCountryIndex();
            this.refreshPagesIndex();
            this.syncDependentFilters();
            this.applyFilters();
            this.showToast('success', 'Вхождение удалено');
        } catch (error) {
            console.error('Ошибка удаления вхождения', error);
            this.showToast('error', error.message || 'Не удалось удалить вхождение');
        } finally {
            this.toggleLoading(false);
        }
    }

    executeConfirmAction() {
        if (typeof this.pendingConfirmAction === 'function') {
            const action = this.pendingConfirmAction;
            this.pendingConfirmAction = null;
            action();
        } else {
            this.closeModal(this.dom.confirmModal);
        }
    }

    async logDocumentEvent({ event_type, document_id, new_document_id = null, previous_document_id = null, affected_usage_ids = [], payload = {} }) {
        try {
            const result = await supabase
                .from('document_events')
                .insert([{
                    event_type,
                    document_id,
                    new_document_id,
                    previous_document_id,
                    affected_usage_ids,
                    performed_by: this.session?.user?.email || 'admin',
                    payload
                }]);
            if (result.error) {
                console.warn('Не удалось записать событие документа', result.error);
                }
            } catch (error) {
            console.warn('Не удалось записать событие документа', error);
        }
    }

    resetFilters() {
        this.state.filters = {
            page: '',
            country: '',
            document: '',
            type: '',
            search: ''
        };
        if (this.dom.filterCountry) this.dom.filterCountry.value = '';
        if (this.dom.filterDocument) this.dom.filterDocument.value = '';
        if (this.dom.filterType) this.dom.filterType.value = '';
        if (this.dom.searchUsageText) this.dom.searchUsageText.value = '';
        if (this.dom.pageSearch) this.dom.pageSearch.value = '';
        this.filterPagesList('');

        this.selectPage('__all', { skipApply: true });
        this.applyFilters();
        this.showToast('info', 'Фильтры сброшены');
    }

    openModal(modal) {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('visible');
    }

    closeModal(modal) {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('visible');
    }

    toggleLoading(isLoading) {
        if (!this.dom.globalLoading) return;
        if (isLoading) {
            this.loadingCount += 1;
        } else {
            this.loadingCount = Math.max(0, this.loadingCount - 1);
        }
        this.dom.globalLoading.classList.toggle('hidden', this.loadingCount === 0);
    }

    handleSupabaseError(error, context = '') {
        if (!error) return false;
        const status = error?.status || (error?.code === 'PGRST301' ? 401 : null);
        const message = (error?.message || '').toLowerCase();

        if (status === 401 || message.includes('jwt') || message.includes('token')) {
            const suffix = context ? ` (${context})` : '';
            this.showToast('error', `Supabase вернул 401 — нет доступа${suffix}. Авторизуйтесь заново или используйте Service Role ключ в админке.`);
            console.warn('Supabase auth error', error);
            if (window.ABU_ADMIN_AUTH && typeof window.ABU_ADMIN_AUTH.requireAuth === 'function') {
                window.ABU_ADMIN_AUTH.requireAuth({ returnTo: 'admin-documents.html' });
            }
            return true;
        }
        return false;
    }

    showToast(type, message) {
        if (!this.dom.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="${type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-times-circle' : 'fas fa-info-circle'}"></i>
            <span>${escapeHtml(message)}</span>
            <button aria-label="Закрыть уведомление">&times;</button>
        `;

        const remove = () => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 200);
        };

        toast.querySelector('button').addEventListener('click', remove);
        this.dom.toastContainer.appendChild(toast);
        setTimeout(remove, 4000);
    }

    toggleDocumentSelector(show, hintText = '') {
        if (!this.dom.usageDocumentGroup || !this.dom.usageDocument) return;
        if (show) {
            this.dom.usageDocumentGroup.classList.remove('hidden');
            this.dom.usageDocument.disabled = false;
            this.dom.usageDocumentHint?.classList.add('hidden');
            this.dom.usageDocumentHint && (this.dom.usageDocumentHint.textContent = '');
        } else {
            this.dom.usageDocumentGroup.classList.add('hidden');
            this.dom.usageDocument.disabled = true;
            this.dom.usageDocument.value = '';
            if (this.dom.usageDocumentHint) {
                this.dom.usageDocumentHint.textContent = hintText || 'Загрузите файл, чтобы добавить новый документ.';
                this.dom.usageDocumentHint.classList.remove('hidden');
            }
        }
    }
}

let documentsAdmin;

document.addEventListener('DOMContentLoaded', () => {
    const init = () => {
        if (documentsAdmin) return;
        documentsAdmin = new DocumentUsageAdmin();
            window.documentsAdmin = documentsAdmin;
    };

    if (window.ABU_ADMIN_AUTH && window.ABU_ADMIN_AUTH.isAuthenticated) {
        init();
    } else {
        window.addEventListener('abu-admin-authenticated', init, { once: true });
    }
});

