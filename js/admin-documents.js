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

// Технические файлы, которые не являются университетами и не должны попадать на страницу Our-partners
const TECHNICAL_FILES = new Set([
    'Results of international cooperation.pdf',
    'Results of international cooperation',
    'Документы для иностранных студентов.pdf',
    'Документы для иностранных студентов',
    'Международная брошюра.pdf',
    'Международная брошюра',
    'Положение о привлечении зарубежных ученых.pdf',
    'Положение о привлечении зарубежных ученых',
    'Положение об академ.моб 2023.pdf',
    'Положение об академ.моб 2023',
    'Положение об академической мобильности',
    'Международный университет Финал.pdf',
    'Международный университет Финал'
]);

// Функция для проверки, является ли файл техническим
function isTechnicalFile(fileName) {
    if (!fileName) return false;
    const nameWithoutExt = fileName.replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, '').trim();
    return TECHNICAL_FILES.has(fileName) || TECHNICAL_FILES.has(nameWithoutExt);
}

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
    // Маппинг названий файлов на правильные названия университетов
    static UNIVERSITY_NAME_MAPPING = {
        'University of Pannonia.pdf': 'University of Pannonia',
        'University of Pannonia': 'University of Pannonia',
        'Автономная некоммерческая организация высшего образования Российский новый университет (РосНОУ).pdf': 'Российский новый университет (РосНОУ)',
        'Аграрный университет г.Пловдив.pdf': 'Аграрный университет Пловдив',
        'Алтайский государственный университет (АГУ).pdf': 'Алтайский государственный университет',
        'Белостокский государственный университет.pdf': 'Белостокский государственный университет',
        'Бельско-Бяльская техническо-гуманитарная Академия.pdf': 'Бельско-Бяльская техническо-гуманитарная академия',
        'Варненский Свободный университет.pdf': 'Варненский свободный университет',
        'Гос.автономное об уч высшего образования города Москвы «МГПУ».pdf': 'Московский городской педагогический университет (МГПУ)',
        'Естественно-гуманитарный университет города Седльце.pdf': 'Естественно-гуманитарный университет Седльце',
        'Индийский технологический институт Бомбей.pdf': 'Индийский технологический институт Бомбей',
        'Каракалпакский государственный университет имени Бердаха.pdf': 'Каракалпакский государственный университет имени Бердаха',
        'Кемеровский государственный университет (КемГУ).pdf': 'Кемеровский государственный университет',
        'Колледж по маркетингу, менеджменту и торговле.pdf': 'Колледж по маркетингу, менеджменту и торговле',
        'Кузбасский государственный технический университет имени Т. Ф. Горбачёва (КузГТУ).pdf': 'Кузбасский государственный технический университет',
        'Лесотехнический университет - София.pdf': 'Лесотехнический университет София',
        'Лесотехнический университет.pdf': 'Лесотехнический университет',
        'Международный университет Финал.pdf': 'Международный университет Финал',
        'Национальный исследовательский университет «МЭИ».pdf': 'МЭИ',
        'Новосибирский государственный архитектурно-строительный университет (Сибстрин).pdf': 'Новосибирский ГАСУ (Сибстрин)',
        'Новый Болгарский университет.pdf': 'Новый Болгарский университет',
        'Омский государственный аграрный университет имени П. А. Столыпина (Омский ГАУ).pdf': 'Омский ГАУ',
        'Резекненская академия технологий (RTA).pdf': 'Резекненская академия технологий',
        'Софийский университет имени святого Климента Охридского.pdf': 'Софийский университет',
        'Стамбульский университет Айдын.pdf': 'Университет Айдын, Стамбул',
        'Технический университет София.pdf': 'Технический университет София',
        'Университет Анкары Хачи Байрам Вели.pdf': 'Университет Анкары Хачи Байрам Вели',
        'Университет Европейского центра мира и развития.pdf': 'Университет Европейского центра мира и развития',
        'Университет Кассино.pdf': 'Университет Кассино',
        'Университет Памуккале 2.pdf': 'Университет Памуккале',
        'Университет Пантеон.pdf': 'Университет Пантеон',
        'Университет английского и иностранных языков.pdf': 'Университет английского и иностранных языков',
        'Университет менеджмента Варна (УМВ).pdf': 'Университет менеджмента Варна',
        'ФГАОУ ВО Северо-Кавказский федеральный университет, СКФУ.pdf': 'Северо-Кавказский федеральный университет',
        'ФГБОУ ВО «Российская академия народного хозяйства и государственной службы при Президенте Российской Федерации» (РАНХиГС).pdf': 'РАНХиГС',
        'ФГБОУ ВО Российский государственный университет туризма и сервиса (РГУТИС).pdf': 'РГУТИС',
        'ФГБОУ ВО «Красноярский государственный педагогический университет им. В.П.Астафьева».pdf': 'Красноярский ГПУ им. Астафьева',
        'ФГБОУ ВО «Новосибирский государственный университет» (НГУ).pdf': 'Новосибирский государственный университет (НГУ)',
        'ФГБОУ ВО «Югорский государственный университет» (ЮГУ).pdf': 'Югорский государственный университет',
        'ФГБОУ ВО Алтайский государственный педагогический университет.pdf': 'Алтайский ГПУ',
        'ФГБОУ ВО Кубанский государственный университет (КубГУ).pdf': 'Кубанский государственный университет',
        'ФГБОУ ВО МГТУ Московский государственный технологический университет СТАНКИН.pdf': 'МГТУ СТАНКИН',
        'ФГБОУ ВО Новосибирский государственный педагогический университет (НГПУ).pdf': 'Новосибирский ГПУ',
        'ФГБОУ ВО Новосибирский государственный университет экономики и управления НИНХ.pdf': 'Новосибирский государственный университет экономики и управления НИНХ',
        'ФГБОУ ВО Псковский государственный университет.pdf': 'Псковский государственный университет',
        'ФГБОУ ВО Санкт-Петербургский государственный лесотехнический университет имени С.М. Кирова.pdf': 'СПбГЛТУ',
        'ФГБОУ ВО Томский государственный архитектурно-строительный университет.pdf': 'Томский ГАСУ',
        'Филиал МГУ им. М.В. Ломоносова в г. Ташкенте.pdf': 'Филиал МГУ в Ташкенте',
        'Частное учреждение образовательная организация высшего образования Омская гуманитарная академия.pdf': 'Омская гуманитарная академия',
        'Швейцарская школа прикладных наук, Swiss SASEM, Факультет экономики и менеджмента.pdf': 'Swiss SASEM',
        '№42-23_Pamukkale_Uni_MOU.pdf': 'Университет Памуккале (MOU)'
    };

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
        // Старый способ через Supabase Auth больше не используется
        return null;
    }

    cacheDom() {
        this.dom.filterCountry = document.getElementById('filterCountry');
        this.dom.filterDocument = document.getElementById('filterDocument');
        this.dom.filterType = document.getElementById('filterType');
        this.dom.searchUsageText = document.getElementById('searchUsageText');
        this.dom.resetFiltersBtn = document.getElementById('resetFiltersBtn');
        this.dom.refreshUsagesBtn = document.getElementById('refreshUsagesBtn');
        this.dom.addUsageBtn = document.getElementById('addUsageBtn');
        this.dom.autoCreateUsagesBtn = document.getElementById('autoCreateUsagesBtn');
        this.dom.organizeFilesBtn = document.getElementById('organizeFilesBtn');
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
        this.dom.usageUrl = document.getElementById('usageUrl');
        this.dom.usageUrlGroup = document.getElementById('usageUrlGroup');
        this.dom.usageFlagImage = document.getElementById('usageFlagImage');
        this.dom.usageFlagImageGroup = document.getElementById('usageFlagImageGroup');
        this.dom.usageDocument = document.getElementById('usageDocument');
        this.dom.usageDocumentMeta = document.getElementById('usageDocumentMeta');
        this.dom.usageDocumentGroup = document.getElementById('usageDocumentGroup');
        this.dom.usageDocumentHint = document.getElementById('usageDocumentHint');
        this.dom.usageLinkText = document.getElementById('usageLinkText');
        this.dom.usageLinkTextKz = document.getElementById('usageLinkTextKz');
        this.dom.usageLinkTextEn = document.getElementById('usageLinkTextEn');
        this.dom.visitButtonText = document.getElementById('visitButtonText');
        this.dom.visitButtonTextKz = document.getElementById('visitButtonTextKz');
        this.dom.visitButtonTextEn = document.getElementById('visitButtonTextEn');
        this.dom.visitButtonTextGroup = document.getElementById('visitButtonTextGroup');
        this.dom.visitButtonTextKzGroup = document.getElementById('visitButtonTextKzGroup');
        this.dom.visitButtonTextEnGroup = document.getElementById('visitButtonTextEnGroup');
        this.dom.usageCardFields = document.getElementById('usageCardFields');
        this.dom.usageCardImage = document.getElementById('usageCardImage');
        this.dom.usageCardImageKey = document.getElementById('usageCardImageKey');
        this.dom.usageCardImageUpload = document.getElementById('usageCardImageUpload');
        this.dom.usageCardDescription = document.getElementById('usageCardDescription');
        this.dom.usageCardDescriptionKz = document.getElementById('usageCardDescriptionKz');
        this.dom.usageCardDescriptionEn = document.getElementById('usageCardDescriptionEn');
        this.dom.usageFileUpload = document.getElementById('usageFileUpload');
        this.dom.usageFileUrl = document.getElementById('usageFileUrl');
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
        this.dom.autoCreateUsagesBtn?.addEventListener('click', () => this.autoCreateUsagesForPartners());
        this.dom.organizeFilesBtn?.addEventListener('click', () => {
            // Показываем меню выбора действия
            const action = confirm(
                'Выберите действие:\n\n' +
                'OK - Миграция из files/ в OurPartners/\n' +
                'Отмена - Организация существующих файлов OurPartners/'
            );
            
            if (action) {
                this.migrateFilesFromFilesToOurPartners();
            } else {
                this.organizeFilesInR2();
            }
        });

        this.dom.addUsageBtn?.addEventListener('click', () => this.openUsageModal());

        this.dom.usagesTableBody?.addEventListener('click', (event) => {
            const toggleBtn = event.target.closest('.btn-text-toggle');
            if (toggleBtn) {
                const usageId = toggleBtn.getAttribute('data-usage-id');
                const row = toggleBtn.closest('tr');
                if (row) {
                    const content = row.querySelector('.usage-text-content');
                    const full = row.querySelector('.usage-text-full');
                    if (content && full) {
                        if (full.style.display === 'none') {
                            content.style.display = 'none';
                            full.style.display = 'inline';
                            toggleBtn.textContent = 'Свернуть';
                        } else {
                            content.style.display = 'inline';
                            full.style.display = 'none';
                            toggleBtn.textContent = 'Читать еще';
                        }
                    }
                }
                event.stopPropagation();
                return;
            }
            this.handleTableClick(event);
        });

        this.dom.usageForm?.addEventListener('submit', (event) => this.handleUsageSubmit(event));

        this.dom.usageFilePreview?.addEventListener('click', () => this.dom.usageFileUpload?.click());
        this.dom.usageFileUpload?.addEventListener('change', (event) => {
            this.handleFileSelection(event);
            // Очищаем URL при выборе файла
            if (this.dom.usageFileUrl) this.dom.usageFileUrl.value = '';
        });
        // Debounce для проверки URL документа
        let urlCheckTimeout = null;
        this.dom.usageFileUrl?.addEventListener('input', async (event) => {
            const url = event.target.value.trim();
            // Очищаем файл при вводе URL
            if (this.dom.usageFileUpload) this.dom.usageFileUpload.value = '';
            this.pendingFile = null;
            this.updateFilePreview();
            
            // Очищаем предыдущий таймер
            if (urlCheckTimeout) {
                clearTimeout(urlCheckTimeout);
            }
            
            // Проверяем, существует ли документ с таким URL (с задержкой 500ms после окончания ввода)
            if (url && url.startsWith('http')) {
                urlCheckTimeout = setTimeout(async () => {
                    try {
                        // Сначала проверяем в уже загруженных документах
                        const existingInState = this.state.documents.find(doc => doc.file_url === url);
                        
                        if (existingInState) {
                            // Документ найден в состоянии - выбираем его
                            if (this.dom.usageDocument) {
                                this.dom.usageDocument.value = existingInState.id;
                                this.handleUsageDocumentChange();
                                this.showToast('success', `Документ "${existingInState.file_name}" найден и выбран`);
                            }
                        } else {
                            // Если не найден в состоянии, проверяем в базе (только если URL валидный и полный)
                            if (url.length > 20 && url.includes('://')) {
                                const { data: existingDoc, error } = await supabase
                                    .from('documents')
                                    .select('*')
                                    .eq('file_url', url)
                                    .maybeSingle();
                                
                                if (!error && existingDoc) {
                                    // Добавляем документ в состояние, если его там нет
                                    if (!this.state.documents.find(d => d.id === existingDoc.id)) {
                                        this.state.documents.push(normalizeDocumentRecord(existingDoc));
                                        this.populateDocumentOptions();
                                    }
                                    
                                    // Выбираем документ в списке
                                    if (this.dom.usageDocument) {
                                        this.dom.usageDocument.value = existingDoc.id;
                                        this.handleUsageDocumentChange();
                                        this.showToast('success', `Документ "${existingDoc.file_name}" найден и выбран`);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        // Игнорируем ошибки при проверке
                        console.debug('Проверка существования документа:', error);
                    }
                }, 500); // Задержка 500ms после окончания ввода
            } else {
                // Если URL очищен, сбрасываем выбор документа
                if (this.dom.usageDocument && !this.dom.usageFileUpload?.files?.length) {
                    this.dom.usageDocument.value = '';
                }
            }
        });

        this.dom.usagePage?.addEventListener('change', () => {
            const slug = this.dom.usagePage.value;
            const usage = this.getUsageById(this.dom.usageId?.value || '');
            this.applyPageSpecificFields(slug, usage);
        });

        this.dom.usageDocument?.addEventListener('change', () => this.handleUsageDocumentChange());

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
            // Скрываем поля для непартнерских страниц
            if (this.dom.usageUrlGroup) {
                this.dom.usageUrlGroup.classList.add('hidden');
                if (this.dom.usageUrl) {
                    this.dom.usageUrl.value = '';
                }
            }
            if (this.dom.usageFlagImageGroup) {
                this.dom.usageFlagImageGroup.classList.add('hidden');
                if (this.dom.usageFlagImage) {
                    this.dom.usageFlagImage.value = '';
                }
            }
            if (this.dom.visitButtonTextGroup) {
                this.dom.visitButtonTextGroup.classList.add('hidden');
                if (this.dom.visitButtonText) this.dom.visitButtonText.value = '';
            }
            if (this.dom.visitButtonTextKzGroup) {
                this.dom.visitButtonTextKzGroup.classList.add('hidden');
                if (this.dom.visitButtonTextKz) this.dom.visitButtonTextKz.value = '';
            }
            if (this.dom.visitButtonTextEnGroup) {
                this.dom.visitButtonTextEnGroup.classList.add('hidden');
                if (this.dom.visitButtonTextEn) this.dom.visitButtonTextEn.value = '';
            }
            return;
        }

        // Показываем поля для партнерской страницы
        this.dom.usageCountryGroup.classList.remove('hidden');
        if (this.dom.usageUrlGroup) {
            this.dom.usageUrlGroup.classList.remove('hidden');
        }
        if (this.dom.usageFlagImageGroup) {
            this.dom.usageFlagImageGroup.classList.remove('hidden');
        }
        if (this.dom.visitButtonTextGroup) {
            this.dom.visitButtonTextGroup.classList.remove('hidden');
        }
        if (this.dom.visitButtonTextKzGroup) {
            this.dom.visitButtonTextKzGroup.classList.remove('hidden');
        }
        if (this.dom.visitButtonTextEnGroup) {
            this.dom.visitButtonTextEnGroup.classList.remove('hidden');
        }

        if (!this.dom.usageCountry.value) {
            const preset = (usage?.country || prefill?.country || '').trim();
            if (preset) {
                this.dom.usageCountry.value = preset;
            }
        }

        // Заполняем URL из metadata документа
        if (this.dom.usageUrl && !this.dom.usageUrl.value) {
            const metadata = usage?.document?.metadata || usage?.metadata || {};
            const urlPreset = metadata.university_url || prefill?.university_url || '';
            if (urlPreset) {
                this.dom.usageUrl.value = urlPreset;
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
            const usageText = usage.usage_text || '';
            const hasLongText = usageText.length > 80;
            const truncatedText = hasLongText ? usageText.slice(0, 80) + '…' : usageText;
            const usageTextDisplay = usageText ? `<span class="usage-text-content">${escapeHtml(truncatedText)}</span>${hasLongText ? `<span class="usage-text-full" style="display:none;">${escapeHtml(usageText)}</span><button class="btn-text-toggle" data-usage-id="${usage.id}" type="button">Читать еще</button>` : ''}` : '<span class="usage-text muted">Текст не указан</span>';
            const countryText = usage.country || '—';
            const sectionText = usage.section || '—';
            const docFileName = doc.file_name || 'Документ';
            const hasLongFileName = docFileName.length > 30;
            const truncatedFileName = hasLongFileName ? docFileName.slice(0, 30) + '…' : docFileName;
            const documentLink = doc.file_url ? `<a href="${doc.file_url}" target="_blank" rel="noopener" class="document-link" title="${escapeHtml(docFileName)}">${escapeHtml(truncatedFileName)}</a>` : '<span class="usage-text muted">Нет ссылки</span>';
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
                            <div class="document-info">
                                <strong class="document-name" title="${escapeHtml(docFileName)}">${escapeHtml(truncatedFileName)}</strong>
                                <div class="document-link-wrapper">${documentLink}</div>
                            </div>
                        </div>
                    </td>
                    <td class="usage-text-cell">${usageTextDisplay}</td>
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
            if (this.dom.usageCardDescriptionKz) this.dom.usageCardDescriptionKz.value = '';
            if (this.dom.usageCardDescriptionEn) this.dom.usageCardDescriptionEn.value = '';
            this.cardFieldsTouched = false;
            this.originalCardImage = '';
            return;
        }

        this.dom.usageCardFields.classList.remove('hidden');

        const description = usage?.usage_text || '';
        if (this.dom.usageCardDescription) this.dom.usageCardDescription.value = description;

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
        this.loadingCount = 0;
        this.hasPageTitleColumn = false;
        this.countriesByPage = new Map();
        this.staticDocumentsByPage = new Map();
        this.htmlPagesCatalog = Object.keys(PAGE_TITLES).filter((slug) => slug !== '__all');
        this.staticScanCompleted = false;
        this.staticScanInProgress = false;
        this.fileProtocolWarningShown = false;

        // Очищаем поле URL файла
        if (this.dom.usageFileUrl) this.dom.usageFileUrl.value = '';

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
            const truncatedDocName = docName.length > 60 ? docName.slice(0, 60) + '…' : docName;
            this.dom.usageModalTitle.innerHTML = `<i class="fas fa-pen-to-square"></i> Вхождение ${usage.id.slice(0, 8)}…`;
            this.dom.usageModalSubtitle.textContent = `Документ: ${truncatedDocName}`;
            this.dom.usageModalSubtitle.title = docName.length > 60 ? docName : ''; // Показываем полное имя при наведении
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
        // Заполняем основные поля
        this.dom.usageLinkText.value = (usage?.link_text || prefill?.linkText || '');
        
        // Заполняем многоязычные поля из metadata
        const metadata = usage?.document?.metadata || usage?.metadata || {};
        if (this.dom.usageLinkTextKz) {
            this.dom.usageLinkTextKz.value = metadata.link_text_kz || '';
        }
        if (this.dom.usageLinkTextEn) {
            this.dom.usageLinkTextEn.value = metadata.link_text_en || '';
        }
        
        if (this.dom.usageCardDescription) {
            this.dom.usageCardDescription.value = usage?.usage_text || prefill?.context || '';
            if (this.dom.usageCardDescriptionKz) {
                this.dom.usageCardDescriptionKz.value = metadata.card_description_kz || '';
            }
            if (this.dom.usageCardDescriptionEn) {
                this.dom.usageCardDescriptionEn.value = metadata.card_description_en || '';
            }
        }
        
        // Заполняем URL из metadata
        if (this.dom.usageUrl) {
            this.dom.usageUrl.value = metadata.university_url || prefill?.university_url || '';
        }
        
        // Заполняем URL изображения флага из metadata
        if (this.dom.usageFlagImage) {
            this.dom.usageFlagImage.value = metadata.flag_image_url || metadata.card_image_url || prefill?.flag_image_url || '';
        }
        
        // Заполняем тексты кнопки "Посетить сайт" из metadata
        if (this.dom.visitButtonText) {
            this.dom.visitButtonText.value = metadata.visit_button_text || 'Посетить сайт';
        }
        if (this.dom.visitButtonTextKz) {
            this.dom.visitButtonTextKz.value = metadata.visit_button_text_kz || 'Сайтқа бару';
        }
        if (this.dom.visitButtonTextEn) {
            this.dom.visitButtonTextEn.value = metadata.visit_button_text_en || 'Visit website';
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
            : '';

        if (!pageValue) {
            this.showToast('error', 'Укажите страницу, на которой размещается документ');
            return;
        }

        const fileUrl = this.dom.usageFileUrl ? this.dom.usageFileUrl.value.trim() : '';
        
        if (!selectedDocumentId && !this.pendingFile && !fileUrl) {
            this.showToast('error', 'Выберите документ, загрузите новый файл или укажите URL файла');
            return;
        }

        if (!this.pendingFile && !selectedDocumentId && !fileUrl) {
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
            } else if (fileUrl) {
                // Создаем документ из URL
                replacementSummary = await this.createDocumentFromUrl({ fileUrl, usageId, cardImageUrl, cardImageKey });
                documentId = replacementSummary?.documentId || documentId;
            }

            // Собираем многоязычные тексты и URL
            const multilingualMetadata = {};
            if (this.dom.usageLinkTextKz?.value.trim()) {
                multilingualMetadata.link_text_kz = this.dom.usageLinkTextKz.value.trim();
            }
            if (this.dom.usageLinkTextEn?.value.trim()) {
                multilingualMetadata.link_text_en = this.dom.usageLinkTextEn.value.trim();
            }
            // Сохраняем URL ссылку на университет
            if (this.dom.usageUrl?.value.trim()) {
                multilingualMetadata.university_url = this.dom.usageUrl.value.trim();
            }
            // Сохраняем URL изображения флага
            if (this.dom.usageFlagImage?.value.trim()) {
                multilingualMetadata.flag_image_url = this.dom.usageFlagImage.value.trim();
            }
            // Сохраняем тексты кнопки "Посетить сайт"
            if (this.dom.visitButtonText?.value.trim()) {
                multilingualMetadata.visit_button_text = this.dom.visitButtonText.value.trim();
            }
            if (this.dom.visitButtonTextKz?.value.trim()) {
                multilingualMetadata.visit_button_text_kz = this.dom.visitButtonTextKz.value.trim();
            }
            if (this.dom.visitButtonTextEn?.value.trim()) {
                multilingualMetadata.visit_button_text_en = this.dom.visitButtonTextEn.value.trim();
            }
            if (isCardPage) {
                if (this.dom.usageCardDescriptionKz?.value.trim()) {
                    multilingualMetadata.card_description_kz = this.dom.usageCardDescriptionKz.value.trim();
                }
                if (this.dom.usageCardDescriptionEn?.value.trim()) {
                    multilingualMetadata.card_description_en = this.dom.usageCardDescriptionEn.value.trim();
                }
            }
            
            const payload = {
                page_slug: normalizedPage,
                section: this.dom.usageSection.value && this.dom.usageSection.value.trim()
                    ? this.dom.usageSection.value.trim()
                    : (normalizedPage ? PAGE_SECTION_DEFAULTS[normalizedPage] || null : null),
                country: this.dom.usageCountry.value.trim() || null,
                usage_text: descriptionValue ? descriptionValue : null,
                link_text: this.dom.usageLinkText.value.trim() || null,
                document_id: documentId
            };

            if (this.hasPageTitleColumn) {
                payload.page_title = normalizedPage ? getPageDisplayName(normalizedPage) : null;
            }

            let updatedUsage = null;

            // === СОХРАНЕНИЕ В SUPABASE ===
            // Данные сохраняются в таблицу 'document_usages'
            // Основные поля: page_slug, section, country, link_text, usage_text, document_id
            // Многоязычные тексты и URL сохраняются в metadata документа (таблица 'documents')
            
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

            // === СОХРАНЕНИЕ МНОГОЯЗЫЧНЫХ ДАННЫХ И URL В METADATA ДОКУМЕНТА ===
            // Многоязычные тексты и URL сохраняются в metadata документа (таблица 'documents')
            // Структура metadata:
            //   - link_text_kz, link_text_en - тексты ссылок на разных языках
            //   - university_url - ссылка на сайт университета
            //   - card_description_kz, card_description_en - описания карточек
            //   - card_image_url, card_image_key - изображения карточек
            if (documentId) {
                const metadataPatch = {
                    ...multilingualMetadata
                };
                
                if (isCardPage) {
                    metadataPatch.card_image_url = cardImageUrl || null;
                    metadataPatch.card_image_key = cardImageKey || null;
                }
                
                // Удаляем пустые значения
                Object.keys(metadataPatch).forEach(key => {
                    if (metadataPatch[key] === null || metadataPatch[key] === '') {
                        delete metadataPatch[key];
                    }
                });
                
                if (Object.keys(metadataPatch).length > 0) {
                    // Обновление происходит в таблице 'documents', поле 'metadata' (JSONB)
                    const refreshedDocument = await this.updateDocumentMetadata(documentId, metadataPatch);
                    if (refreshedDocument) {
                        updatedUsage.document = normalizeDocumentRecord(refreshedDocument);
                        if (this.dom.usageCardImageKey) {
                            this.dom.usageCardImageKey.value = refreshedDocument.metadata?.card_image_key || '';
                        }
                    }
                }
                
                if (isCardPage) {
                    this.originalCardImage = cardImageUrl || '';
                    this.cardFieldsTouched = false;
                }
            }

            this.state.usages = this.state.usages.map((usage) => usage.id === updatedUsage.id ? updatedUsage : usage);

            this.pendingFile = null;
            this.pendingReplaceScope = 'local';
            this.dom.usageFileUpload.value = '';
            if (this.dom.usageFileUrl) this.dom.usageFileUrl.value = '';
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
        
        // Определяем путь в R2 на основе страницы и страны
        let folderPath = '';
        const pageSlug = this.dom.usagePage?.value || '';
        const country = this.dom.usageCountry?.value?.trim() || '';
        
        if (PARTNER_PAGE_SLUGS.has(pageSlug) && country) {
            // Для Our-partners используем структуру OurPartners/Страна/
            const countryFolderMapping = {
                'Азербайджан': 'Azerbaijan',
                'Болгария': 'Bulgaria',
                'Венгрия': 'Hungary',
                'Германия': 'Germany',
                'Индия': 'India',
                'Испания': 'Spain',
                'Италия': 'Italy',
                'Китай': 'China',
                'Латвия': 'Latvia',
                'Польша': 'Poland',
                'Россия': 'Russia',
                'Словакия': 'Slovakia',
                'Таджикистан': 'Tajikistan',
                'Туркменистан': 'Turkmenistan',
                'Турция': 'Turkey',
                'Узбекистан': 'Uzbekistan',
                'Черногория': 'Montenegro',
                'Швейцария': 'Switzerland'
            };
            const countryFolder = countryFolderMapping[country] || country.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
            folderPath = `OurPartners/${countryFolder}`;
        }

        const uploadMeta = await this.uploadFileToR2(file, oldDocument, folderPath);
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

    async createDocumentFromUrl({ fileUrl, usageId, cardImageUrl = '', cardImageKey = '' }) {
        if (!fileUrl || !fileUrl.trim()) return null;

        // Валидация URL
        try {
            new URL(fileUrl);
        } catch (error) {
            throw new Error('Некорректный URL файла');
        }

        const existingUsage = usageId ? this.state.usages.find((item) => item.id === usageId) : null;
        const oldDocument = existingUsage?.document || null;

        // Извлекаем имя файла из URL
        let fileName = '';
        try {
            const url = new URL(fileUrl);
            const pathParts = url.pathname.split('/').filter(p => p);
            fileName = pathParts[pathParts.length - 1] || 'document.pdf';
        } catch (error) {
            fileName = 'document.pdf';
        }

        // Определяем расширение файла
        const extension = (fileName.split('.').pop() || 'pdf').toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            throw new Error('Поддерживаются только PDF, DOC(X), XLS(X), PPT(X)');
        }

        // Извлекаем file_key из URL (путь без домена)
        let fileKey = '';
        try {
            const url = new URL(fileUrl);
            fileKey = decodeURIComponent(url.pathname.replace(/^\//, ''));
        } catch (error) {
            fileKey = fileName;
        }

        // Создаем метаданные для документа
        const uploadMeta = {
            file_key: fileKey,
            file_url: fileUrl.trim(),
            file_name: fileName,
            file_type: extension,
            file_size: null, // Размер неизвестен для внешних URL
            version: oldDocument ? (oldDocument.version || 1) + 1 : 1
        };

        const newDocument = await this.createDocumentRecord(uploadMeta, oldDocument, {
            card_image_url: cardImageUrl || null,
            card_image_key: cardImageKey || null,
            source: 'external_url'
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
        }

        return {
            documentId: newDocument.id,
            message: 'Документ добавлен по URL'
        };
    }

    async uploadFileToR2(file, previousDocument = null, folderPath = '') {
        const fileName = file.name;
        // Если указан путь к папке, добавляем его к имени файла
        const filePath = folderPath 
            ? `${folderPath.replace(/\/$/, '')}/${fileName}` 
            : fileName;
        
        const response = await fetch(`${R2_WORKER_URL}/upload?name=${encodeURIComponent(filePath)}`, {
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

        const fileUrl = payload?.url || `${(R2_PUBLIC_URL || '').replace(/\/$/, '')}/${encodeURIComponent(filePath)}`;
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
            fileKey = previousDocument?.file_key || filePath;
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
        
        // Сначала проверяем, существует ли документ с таким URL или file_key
        let existing = null;
        
        // Проверяем по file_url (приоритет)
        if (meta.file_url) {
            const { data: urlData, error: urlError } = await supabase
                .from('documents')
                .select('*')
                .eq('file_url', meta.file_url)
                .maybeSingle();
            if (!urlError && urlData) {
                existing = urlData;
            }
        }
        
        // Если не нашли по URL, проверяем по file_key
        if (!existing && fileKeyFallback) {
            const { data: keyData, error: keyError } = await supabase
                .from('documents')
                .select('*')
                .eq('file_key', fileKeyFallback)
                .maybeSingle();
            if (!keyError && keyData) {
                existing = keyData;
            }
        }

        // Если документ существует, обновляем его
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

        // Если документа нет, создаем новый
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

        const { data: inserted, error: insertError } = await supabase
            .from('documents')
            .insert([payload])
            .select('*')
            .single();

        if (insertError) {
            // Если все же произошла ошибка (например, другой процесс создал документ),
            // пытаемся найти существующий
            if (insertError.code === '23505' || insertError.code === 'PGRST302' || insertError.code === 'PGRST303' || 
                insertError.code === '409' || insertError.code === 409 || 
                (insertError.message && insertError.message.toLowerCase().includes('duplicate'))) {
                
                // Повторная попытка найти существующий документ
                if (meta.file_url) {
                    const { data: retryData } = await supabase
                        .from('documents')
                        .select('*')
                        .eq('file_url', meta.file_url)
                        .maybeSingle();
                    if (retryData) {
                        return normalizeDocumentRecord(retryData);
                    }
                }
            }
            throw insertError;
        }

        return normalizeDocumentRecord(inserted);
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
        // Устанавливаем aria-hidden="false" для показа модального окна (CSS требует этот атрибут)
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('visible');
        // Устанавливаем фокус после того, как aria-hidden убран
        requestAnimationFrame(() => {
            const firstFocusable = modal.querySelector('button:not([data-close-modal]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable && !firstFocusable.disabled) {
                firstFocusable.focus();
            }
        });
    }

    closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('visible');
        // Устанавливаем aria-hidden="true" для скрытия модального окна
        modal.setAttribute('aria-hidden', 'true');
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

    async autoCreateUsagesForPartners() {
        const pageSlug = 'Our-partners.html';
        
        // Подтверждение действия с опцией очистки
        const clearExisting = confirm(
            '⚠️ ВНИМАНИЕ: Это пересоздаст ВСЕ вхождения для страницы "Our-partners.html".\n\n' +
            'Существующие вхождения будут УДАЛЕНЫ и созданы заново с правильными данными.\n\n' +
            'Нажмите OK для пересоздания, Отмена - для добавления только новых документов.'
        );
        
        if (clearExisting === null) return; // Пользователь отменил
        
        // Если пользователь хочет пересоздать, спрашиваем еще раз
        if (clearExisting) {
            const finalConfirm = confirm(
                'Вы уверены? Все существующие вхождения для "Our-partners.html" будут удалены!\n\n' +
                'Это действие нельзя отменить.'
            );
            if (!finalConfirm) return;
        }
        
        try {
            this.toggleLoading(true);
            this.showToast('info', 'Начинаю автоматическое создание вхождений...');
            
            // Получаем все документы
            const { data: documents, error: docsError } = await supabase
                .from('documents')
                .select('id, file_name, metadata, file_key')
                .eq('is_active', true)
                .order('file_name', { ascending: true });
            
            if (docsError) {
                throw new Error(`Ошибка загрузки документов: ${docsError.message}`);
            }
            
            if (!documents || documents.length === 0) {
                this.showToast('warning', 'Документы не найдены');
                return;
            }
            
            // Фильтруем технические файлы
            const universityDocuments = documents.filter(doc => !isTechnicalFile(doc.file_name));
            
            if (universityDocuments.length === 0) {
                this.showToast('warning', 'Не найдено документов университетов (все файлы являются техническими)');
                return;
            }
            
            const technicalCount = documents.length - universityDocuments.length;
            if (technicalCount > 0) {
                this.showToast('info', `Пропущено технических файлов: ${technicalCount}`);
            }
            
            // Если нужно пересоздать - удаляем все существующие вхождения
            if (clearExisting) {
                this.showToast('info', 'Удаляю существующие вхождения...');
                const { error: deleteError } = await supabase
                    .from('document_usages')
                    .delete()
                    .eq('page_slug', pageSlug);
                
                if (deleteError) {
                    throw new Error(`Ошибка удаления существующих вхождений: ${deleteError.message}`);
                }
                
                this.showToast('info', 'Существующие вхождения удалены. Создаю новые...');
            } else {
                // Получаем существующие вхождения для этой страницы
                const { data: existingUsages, error: usagesError } = await supabase
                    .from('document_usages')
                    .select('document_id')
                    .eq('page_slug', pageSlug);
                
                if (usagesError) {
                    throw new Error(`Ошибка проверки существующих вхождений: ${usagesError.message}`);
                }
                
                const existingDocIds = new Set((existingUsages || []).map(u => u.document_id));
                
                // Фильтруем документы - только те, для которых еще нет вхождений
                documents = documents.filter(doc => !existingDocIds.has(doc.id));
                
                if (documents.length === 0) {
                    this.showToast('info', 'Все документы уже имеют вхождения для этой страницы');
                    return;
                }
            }
            
            const documentsToProcess = universityDocuments;
            
            // Точный маппинг университет -> страна (на основе данных из document-renderer.js)
            const universityToCountry = {
                // Азербайджан
                'Azerbaijan University of Languages': 'Азербайджан',
                'Baku State University': 'Азербайджан',
                // Болгария
                'Sofia University "St. Kliment Ohridski"': 'Болгария',
                'Софийский университет имени святого Климента Охридского': 'Болгария',
                'Technical University of Sofia': 'Болгария',
                'Технический университет София': 'Болгария',
                'University of Forestry': 'Болгария',
                'Varna University of Management': 'Болгария',
                'Agricultural University of Plovdiv': 'Болгария',
                'Varna Free University': 'Болгария',
                'New Bulgarian University': 'Болгария',
                'University of European Centre for Peace and Development': 'Болгария',
                // Венгрия
                'University of Pannonia': 'Венгрия',
                // Германия
                'Fachhochschule des Mittelstands (FHM)': 'Германия',
                'University of Konstanz': 'Германия',
                // Индия
                'Indian Institute of Technology Bombay': 'Индия',
                'Индийский технологический институт Бомбей': 'Индия',
                'English and Foreign Languages University': 'Индия',
                // Испания
                'University of Santiago de Compostela': 'Испания',
                // Италия
                'Eurac Research': 'Италия',
                'University NiccolГІ Cusano': 'Италия',
                'University Niccolò Cusano': 'Италия',
                // Китай
                'Jilin Normal University': 'Китай',
                // Польша
                'Poznan University of Technology': 'Польша',
                'University of Bialystok': 'Польша',
                'Eastern European University of Applied Sciences in Bialystok': 'Польша',
                'University of Natural Sciences and Humanities in Siedlce': 'Польша',
                // Россия
                'Saint Petersburg State Forest Technical University': 'Россия',
                'Saint Petersburg State University': 'Россия',
                'Kazan Federal University': 'Россия',
                'Innopolis University': 'Россия',
                'Nizhnevartovsk State University': 'Россия',
                'Kuban State University': 'Россия',
                'Kuzbass State Technical University': 'Россия',
                'Altai State University': 'Россия',
                'Altai State Pedagogical University': 'Россия',
                'Omsk State Pedagogical University': 'Россия',
                'Russian New University (RosNOU)': 'Россия',
                'Moscow City Pedagogical University (MSPU)': 'Россия',
                'Kemerovo State University (KemSU)': 'Россия',
                'College of Marketing, Management and Trade': 'Россия',
                'National Research University "MEI"': 'Россия',
                'Novosibirsk State University of Architecture and Civil Engineering (Sibstrin)': 'Россия',
                'North Caucasus Federal University (SKFU)': 'Россия',
                'Russian Presidential Academy of National Economy and Public Administration (RANEPA)': 'Россия',
                'Russian State University of Tourism and Service (RSUTS)': 'Россия',
                'Krasnoyarsk State Pedagogical University named after V.P. Astafyev': 'Россия',
                'Novosibirsk State University (NSU)': 'Россия',
                'Yugra State University (YSU)': 'Россия',
                'Moscow State Technological University STANKIN': 'Россия',
                'Novosibirsk State Pedagogical University (NSPU)': 'Россия',
                'Novosibirsk State University of Economics and Management (NINH)': 'Россия',
                'Pskov State University': 'Россия',
                // Словакия
                'Constantine the Philosopher University in Nitra': 'Словакия',
                // Таджикистан
                'Tajik State University of Commerce': 'Таджикистан',
                'Technological University of Tajikistan': 'Таджикистан',
                // Туркменистан
                'Turkmen State Institute of Economics and Management': 'Туркменистан',
                // Турция
                'Duzce University': 'Турция',
                'Ege University': 'Турция',
                'Istanbul Aydin University': 'Турция',
                'Pamukkale University': 'Турция',
                'Yeditepe University': 'Турция',
                'Ankara Haci Bayram Veli University': 'Турция',
                'Pantheon University': 'Турция',
                // Узбекистан
                'Management Development Institute of Tashkent (MDIS)': 'Узбекистан',
                'Westminster International University in Tashkent (WIUT)': 'Узбекистан',
                'Central Asian University (CAU)': 'Узбекистан',
                'Branch of Moscow State University Named for M.V. Lomonosov in Tashkent': 'Узбекистан',
                'Karakalpak State University named after Berdakh': 'Узбекистан',
                // Черногория
                'Adriatic University Bar': 'Черногория',
                // Швейцария
                'Swiss School of Applied Sciences for Economics and Management': 'Швейцария',
                'Swiss International Business School': 'Швейцария',
                // Латвия
                'Rezekne Academy of Technologies (RTA)': 'Латвия',
                // Русские названия (из списка пользователя)
                'Аграрный университет г.Пловдив': 'Болгария',
                'Варненский Свободный университет': 'Болгария',
                'Лесотехнический университет - София': 'Болгария',
                'Лесотехнический университет': 'Болгария',
                'Новый Болгарский университет': 'Болгария',
                'Софийский университет имени святого Климента Охридского': 'Болгария',
                'Технический университет София': 'Болгария',
                'Университет Европейского центра мира и развития': 'Болгария',
                'Университет менеджмента Варна (УМВ)': 'Болгария',
                'Индийский технологический институт Бомбей': 'Индия',
                'Университет английского и иностранных языков': 'Индия',
                'Университет Кассино': 'Италия',
                'Университет Пантеон': 'Турция',
                'Резекненская академия технологий (RTA)': 'Латвия',
                'Белостокский государственный университет': 'Польша',
                'Бельско-Бяльская техническо-гуманитарная Академия': 'Польша',
                'Естественно-гуманитарный университет города Седльце': 'Польша',
                'Автономная некоммерческая организация высшего образования Российский новый университет (РосНОУ)': 'Россия',
                'Алтайский государственный университет (АГУ)': 'Россия',
                'Гос.автономное об уч высшего образования города Москвы «МГПУ»': 'Россия',
                'Кемеровский государственный университет (КемГУ)': 'Россия',
                'Колледж по маркетингу, менеджменту и торговле': 'Россия',
                'Кузбасский государственный технический университет имени Т. Ф. Горбачёва (КузГТУ)': 'Россия',
                'Национальный исследовательский университет «МЭИ»': 'Россия',
                'Новосибирский государственный архитектурно- строительный университет (Сибстрин)': 'Россия',
                'Омский государственный аграрный университет имени П. А. Столыпина (Омский ГАУ)': 'Россия',
                'ФГАОУ ВО Северо-Кавказский федеральный университет, СКФУ': 'Россия',
                'ФГБОУ ВО «Российская академия народного хозяйства и государственной службы при Президенте Российской Федерации» (РАНХиГС)': 'Россия',
                'ФГБОУ ВО Российский государственный университет туризма и сервиса (РГУТИС)': 'Россия',
                'ФГБОУ ВО «Красноярский государственный педагогический университет им. В.П.Астафьева»': 'Россия',
                'ФГБОУ ВО «Новосибирский государственный университет» (НГУ)': 'Россия',
                'ФГБОУ ВО «Российский Государственный университет туризма и сервиса» (РГУТИС)': 'Россия',
                'ФГБОУ ВО «Югорский государственный университет» (ЮГУ)': 'Россия',
                'ФГБОУ ВО Алтайский государственный педагогический университет': 'Россия',
                'ФГБОУ ВО Кубанский государственный университет (КубГУ)': 'Россия',
                'ФГБОУ ВО МГТУ Московский государственный технологический университет СТАНКИН': 'Россия',
                'ФГБОУ ВО Новосибирский государственный педагогический университет (НГПУ)': 'Россия',
                'ФГБОУ ВО Новосибирский государственный университет экономики и управления НИНХ': 'Россия',
                'ФГБОУ ВО Псковский государственный университет': 'Россия',
                'ФГБОУ ВО Санкт-Петербургский государственный лесотехнический университет имени С.М. Кирова': 'Россия',
                'ФГБОУ ВО Томский государственный архитектурно-строительный университет': 'Россия',
                'Частное учреждение образовательная организация высшего образования Омская гуманитарная академия': 'Россия',
                'Стамбульский университет Айдын': 'Турция',
                'Университет Анкары Хачи Байрам Вели': 'Турция',
                'Университет Памуккале 2': 'Турция',
                'Каракалпакский государственный университет имени Бердаха': 'Узбекистан',
                'Филиал МГУ им. М.В. Ломоносова в г. Ташкенте': 'Узбекистан',
                'Швейцарская школа прикладных наук, Swiss SASEM, Факультет экономики и менеджмента': 'Швейцария'
            };
            
            // Функция для определения страны и названия университета
            const detectUniversityAndCountry = (fileName, metadata = {}) => {
                // Сначала проверяем metadata
                if (metadata.country) {
                    return {
                        country: metadata.country,
                        universityName: metadata.link_text_ru || metadata.link_text_en || fileName
                    };
                }
                
                // Убираем расширение файла
                const nameWithoutExt = fileName.replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, '').trim();
                
                // Ищем точное совпадение в маппинге
                if (universityToCountry[nameWithoutExt]) {
                    return {
                        country: universityToCountry[nameWithoutExt],
                        universityName: nameWithoutExt
                    };
                }
                
                // Ищем частичное совпадение (для русских названий)
                for (const [university, country] of Object.entries(universityToCountry)) {
                    if (nameWithoutExt.includes(university) || university.includes(nameWithoutExt)) {
                        return {
                            country: country,
                            universityName: nameWithoutExt
                        };
                    }
                }
                
                // Пытаемся определить по ключевым словам
                const nameLower = nameWithoutExt.toLowerCase();
                const keywordMapping = {
                    'баку': 'Азербайджан',
                    'азербайджан': 'Азербайджан',
                    'софия': 'Болгария',
                    'софийский': 'Болгария',
                    'болгария': 'Болгария',
                    'варна': 'Болгария',
                    'венгрия': 'Венгрия',
                    'pannonia': 'Венгрия',
                    'германия': 'Германия',
                    'konstanz': 'Германия',
                    'fhm': 'Германия',
                    'индия': 'Индия',
                    'bombay': 'Индия',
                    'испания': 'Испания',
                    'santiago': 'Испания',
                    'италия': 'Италия',
                    'cusano': 'Италия',
                    'eurac': 'Италия',
                    'китай': 'Китай',
                    'jilin': 'Китай',
                    'польша': 'Польша',
                    'poznan': 'Польша',
                    'bialystok': 'Польша',
                    'россия': 'Россия',
                    'russia': 'Россия',
                    'петербург': 'Россия',
                    'казань': 'Россия',
                    'innopolis': 'Россия',
                    'новосибирск': 'Россия',
                    'омск': 'Россия',
                    'алтай': 'Россия',
                    'кубан': 'Россия',
                    'словакия': 'Словакия',
                    'nitra': 'Словакия',
                    'таджикистан': 'Таджикистан',
                    'tajikistan': 'Таджикистан',
                    'туркменистан': 'Туркменистан',
                    'turkmenistan': 'Туркменистан',
                    'турция': 'Турция',
                    'turkey': 'Турция',
                    'istanbul': 'Турция',
                    'ankara': 'Турция',
                    'узбекистан': 'Узбекистан',
                    'uzbekistan': 'Узбекистан',
                    'tashkent': 'Узбекистан',
                    'ташкент': 'Узбекистан',
                    'черногория': 'Черногория',
                    'montenegro': 'Черногория',
                    'швейцария': 'Швейцария',
                    'switzerland': 'Швейцария',
                    'swiss': 'Швейцария',
                    'латвия': 'Латвия',
                    'latvia': 'Латвия',
                    'rezekne': 'Латвия'
                };
                
                for (const [keyword, country] of Object.entries(keywordMapping)) {
                    if (nameLower.includes(keyword)) {
                        return {
                            country: country,
                            universityName: nameWithoutExt
                        };
                    }
                }
                
                return {
                    country: null,
                    universityName: nameWithoutExt
                };
            };
            
            // Группируем документы по странам для правильной сортировки
            const documentsByCountry = {};
            const documentsWithoutCountry = [];
            
            documentsToProcess.forEach(doc => {
                const fileName = doc.file_name || '';
                const metadata = doc.metadata || {};
                const { country } = detectUniversityAndCountry(fileName, metadata);
                
                if (country) {
                    if (!documentsByCountry[country]) {
                        documentsByCountry[country] = [];
                    }
                    documentsByCountry[country].push(doc);
                } else {
                    documentsWithoutCountry.push(doc);
                }
            });
            
            // Сортируем страны по алфавиту
            const sortedCountries = Object.keys(documentsByCountry).sort();
            
            // Собираем все документы в правильном порядке: сначала по странам, потом без страны
            const sortedDocuments = [];
            let sortOrder = 10;
            
            sortedCountries.forEach(country => {
                documentsByCountry[country].forEach(doc => {
                    sortedDocuments.push({ ...doc, _sortOrder: sortOrder });
                    sortOrder += 10;
                });
            });
            
            documentsWithoutCountry.forEach(doc => {
                sortedDocuments.push({ ...doc, _sortOrder: sortOrder });
                sortOrder += 10;
            });
            
            // Создаем вхождения пакетами по 50
            const batchSize = 50;
            let created = 0;
            let skipped = 0;
            
            for (let i = 0; i < sortedDocuments.length; i += batchSize) {
                const batch = sortedDocuments.slice(i, i + batchSize);
                
                const usagesToCreate = batch.map((doc) => {
                    const fileName = doc.file_name || '';
                    const metadata = doc.metadata || {};
                    
                    // Определяем страну и название университета
                    const { country, universityName } = detectUniversityAndCountry(fileName, metadata);
                    
                    // Используем название из metadata, если есть, иначе из file_name
                    const linkText = metadata.link_text_ru || metadata.link_text_en || universityName;
                    
                    return {
                        page_slug: pageSlug,
                        document_id: doc.id,
                        link_text: linkText,
                        country: country,
                        section: null,
                        sort_order: doc._sortOrder,
                        usage_text: null
                    };
                });
                
                const { data: createdUsages, error: createError } = await supabase
                    .from('document_usages')
                    .insert(usagesToCreate)
                    .select('id');
                
                if (createError) {
                    console.error('Ошибка создания вхождений:', createError);
                    // Продолжаем с другими документами
                    skipped += batch.length;
                } else {
                    created += createdUsages?.length || 0;
                }
                
                // Обновляем прогресс
                const progress = Math.round(((i + batch.length) / sortedDocuments.length) * 100);
                this.showToast('info', `Обработано: ${i + batch.length} из ${sortedDocuments.length} (${progress}%)`);
            }
            
            // Обновляем данные
            await this.fetchAllData();
            
            this.showToast('success', 
                `Готово! Создано вхождений: ${created}, пропущено: ${skipped}`
            );
            
        } catch (error) {
            console.error('Ошибка автоматического создания вхождений:', error);
            this.showToast('error', `Ошибка: ${error.message}`);
        } finally {
            this.toggleLoading(false);
        }
    }

    // Функция для получения правильного названия университета
    getUniversityDisplayName(fileName) {
        // Убираем расширение для поиска
        const nameWithoutExt = fileName.replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, '').trim();
        
        // Ищем точное совпадение
        if (DocumentUsageAdmin.UNIVERSITY_NAME_MAPPING[fileName]) {
            return DocumentUsageAdmin.UNIVERSITY_NAME_MAPPING[fileName];
        }
        if (DocumentUsageAdmin.UNIVERSITY_NAME_MAPPING[nameWithoutExt]) {
            return DocumentUsageAdmin.UNIVERSITY_NAME_MAPPING[nameWithoutExt];
        }
        
        // Если не найдено, возвращаем оригинальное название без расширения
        return nameWithoutExt;
    }

    // Функция для получения правильного пути в R2 для документа Our-partners
    getR2PathForPartnerDocument(fileName, country, displayName = null) {
        if (!country) {
            return fileName; // Если страна не определена, оставляем в корне
        }
        
        // Получаем правильное название университета из маппинга, если не передано
        if (!displayName) {
            displayName = this.getUniversityDisplayName(fileName);
        }
        
        // Определяем расширение файла
        const extension = fileName.match(/\.([^.]+)$/)?.[1] || 'pdf';
        
        // Создаем безопасное имя файла (убираем специальные символы, но оставляем кириллицу)
        const safeFileName = `${displayName}.${extension}`.replace(/[<>:"|?*]/g, '_');
        
        // Маппинг стран на английские названия для папок (как в R2 Dashboard)
        const countryFolderMapping = {
            'Азербайджан': 'Azerbaijan',
            'Болгария': 'Bulgaria',
            'Венгрия': 'Hungary',
            'Германия': 'Germany',
            'Индия': 'India',
            'Испания': 'Spain',
            'Италия': 'Italy',
            'Китай': 'China',
            'Латвия': 'Latvia',
            'Польша': 'Poland',
            'Россия': 'Russia',
            'Словакия': 'Slovakia',
            'Таджикистан': 'Tajikistan',
            'Туркменистан': 'Turkmenistan',
            'Турция': 'Turkey',
            'Узбекистан': 'Uzbekistan',
            'Черногория': 'Montenegro',
            'Швейцария': 'Switzerland'
        };
        
        const countryFolder = countryFolderMapping[country] || country.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
        
        // Создаем путь: OurPartners/Страна/Университет.pdf
        return `OurPartners/${countryFolder}/${safeFileName}`;
    }

    // Функция для миграции файлов из files/ в OurPartners/Страна/
    async migrateFilesFromFilesToOurPartners() {
        const confirmed = confirm(
            '⚠️ ВНИМАНИЕ: Это переместит файлы из abu-ic/files/ в abu-ic/OurPartners/Страна/\n\n' +
            'Файлы будут перемещены в правильные папки стран с правильными названиями.\n\n' +
            'Продолжить?'
        );
        
        if (!confirmed) return;
        
        try {
            this.toggleLoading(true);
            this.showToast('info', 'Начинаю миграцию файлов из files/ в OurPartners/...');
            
            // Получаем все документы из базы данных
            const { data: documents, error: docsError } = await supabase
                .from('documents')
                .select('id, file_name, file_key, file_url, metadata')
                .eq('is_active', true);
            
            if (docsError) {
                throw new Error(`Ошибка загрузки документов: ${docsError.message}`);
            }
            
            if (!documents || documents.length === 0) {
                this.showToast('warning', 'Документы не найдены');
                return;
            }
            
            // Фильтруем только файлы из папки files/ и исключаем технические
            const filesToMigrate = documents.filter(doc => {
                const fileKey = doc.file_key || '';
                const fileName = doc.file_name || '';
                
                // Только файлы из папки files/
                if (!fileKey.startsWith('files/') && !fileKey.startsWith('OurPartners/')) {
                    return false;
                }
                
                // Уже в правильной папке - пропускаем
                if (fileKey.startsWith('OurPartners/')) {
                    return false;
                }
                
                // Исключаем технические файлы
                if (isTechnicalFile(fileName)) {
                    return false;
                }
                
                return true;
            });
            
            if (filesToMigrate.length === 0) {
                this.showToast('info', 'Нет файлов для миграции');
                return;
            }
            
            this.showToast('info', `Найдено файлов для миграции: ${filesToMigrate.length}`);
            
            let migrated = 0;
            let skipped = 0;
            let errors = 0;
            
            // Обрабатываем файлы по одному
            for (let i = 0; i < filesToMigrate.length; i++) {
                const doc = filesToMigrate[i];
                const fileName = doc.file_name || '';
                const oldFileKey = doc.file_key || '';
                const metadata = doc.metadata || {};
                
                try {
                    // Определяем страну
                    const { country } = this.detectUniversityAndCountry(fileName, metadata);
                    
                    if (!country) {
                        console.warn(`Не удалось определить страну для ${fileName}`);
                        skipped++;
                        continue;
                    }
                    
                    // Получаем правильное название университета из маппинга
                    const displayName = this.getUniversityDisplayName(fileName);
                    
                    // Получаем новый путь с правильным названием
                    const newFileKey = this.getR2PathForPartnerDocument(fileName, country, displayName);
                    
                    // Если путь уже правильный, пропускаем
                    if (oldFileKey === newFileKey) {
                        skipped++;
                        continue;
                    }
                    
                    // Копируем файл через R2 Worker (если поддерживается)
                    // Или просто обновляем путь в базе данных
                    // Примечание: для реального перемещения нужен доступ к R2 API
                    // Здесь мы обновляем только пути в базе данных
                    
                    const newFileUrl = `${(R2_PUBLIC_URL || '').replace(/\/$/, '')}/${encodeURIComponent(newFileKey)}`;
                    
                    // Обновляем file_key и file_url в базе данных
                    const { error: updateError } = await supabase
                        .from('documents')
                        .update({ 
                            file_key: newFileKey,
                            file_url: newFileUrl
                        })
                        .eq('id', doc.id);
                    
                    if (updateError) {
                        console.error(`Ошибка обновления документа ${doc.id}:`, updateError);
                        errors++;
                    } else {
                        migrated++;
                        console.log(`Мигрирован: ${oldFileKey} → ${newFileKey}`);
                    }
                    
                    // Обновляем прогресс каждые 10 файлов
                    if ((i + 1) % 10 === 0) {
                        const progress = Math.round(((i + 1) / filesToMigrate.length) * 100);
                        this.showToast('info', `Обработано: ${i + 1} из ${filesToMigrate.length} (${progress}%)`);
                    }
                    
                } catch (error) {
                    console.error(`Ошибка миграции файла ${fileName}:`, error);
                    errors++;
                }
            }
            
            // Обновляем данные
            await this.fetchAllData();
            
            this.showToast('success', 
                `Готово! Мигрировано: ${migrated}, пропущено: ${skipped}, ошибок: ${errors}\n\n` +
                `⚠️ ВАЖНО: Файлы нужно переместить вручную в Cloudflare R2 Dashboard!\n` +
                `Обновлены только пути в базе данных.`
            );
            
        } catch (error) {
            console.error('Ошибка миграции файлов:', error);
            this.showToast('error', `Ошибка: ${error.message}`);
        } finally {
            this.toggleLoading(false);
        }
    }

    // Функция для определения страны и названия университета (используется в миграции)
    detectUniversityAndCountry(fileName, metadata = {}) {
        // Используем ту же логику, что и в autoCreateUsagesForPartners
        if (metadata.country) {
            return {
                country: metadata.country,
                universityName: metadata.link_text_ru || metadata.link_text_en || fileName
            };
        }
        
        // Убираем расширение файла
        const nameWithoutExt = fileName.replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, '').trim();
        
        // Используем маппинг университетов из autoCreateUsagesForPartners
        // (полный маппинг находится в функции autoCreateUsagesForPartners)
        // Здесь используем упрощенную версию с ключевыми словами
        
        const keywordMapping = {
            'баку': 'Азербайджан', 'азербайджан': 'Азербайджан',
            'софия': 'Болгария', 'софийский': 'Болгария', 'болгария': 'Болгария', 'варна': 'Болгария', 'пловдив': 'Болгария',
            'венгрия': 'Венгрия', 'pannonia': 'Венгрия',
            'германия': 'Германия', 'konstanz': 'Германия', 'fhm': 'Германия',
            'индия': 'Индия', 'bombay': 'Индия', 'бомбей': 'Индия',
            'испания': 'Испания', 'santiago': 'Испания',
            'италия': 'Италия', 'cusano': 'Италия', 'eurac': 'Италия', 'кассино': 'Италия',
            'китай': 'Китай', 'jilin': 'Китай',
            'польша': 'Польша', 'poznan': 'Польша', 'bialystok': 'Польша', 'белосток': 'Польша', 'седльце': 'Польша',
            'россия': 'Россия', 'russia': 'Россия', 'петербург': 'Россия', 'казань': 'Россия', 'innopolis': 'Россия',
            'новосибирск': 'Россия', 'омск': 'Россия', 'алтай': 'Россия', 'кубан': 'Россия', 'кемерово': 'Россия',
            'словакия': 'Словакия', 'nitra': 'Словакия',
            'таджикистан': 'Таджикистан', 'tajikistan': 'Таджикистан',
            'туркменистан': 'Туркменистан', 'turkmenistan': 'Туркменистан',
            'турция': 'Турция', 'turkey': 'Турция', 'istanbul': 'Турция', 'ankara': 'Турция', 'памуккале': 'Турция', 'айдын': 'Турция',
            'узбекистан': 'Узбекистан', 'uzbekistan': 'Узбекистан', 'tashkent': 'Узбекистан', 'ташкент': 'Узбекистан', 'каракалпак': 'Узбекистан',
            'черногория': 'Черногория', 'montenegro': 'Черногория',
            'швейцария': 'Швейцария', 'switzerland': 'Швейцария', 'swiss': 'Швейцария',
            'латвия': 'Латвия', 'latvia': 'Латвия', 'rezekne': 'Латвия', 'резекне': 'Латвия'
        };
        
        const nameLower = nameWithoutExt.toLowerCase();
        for (const [keyword, country] of Object.entries(keywordMapping)) {
            if (nameLower.includes(keyword)) {
                return {
                    country: country,
                    universityName: nameWithoutExt
                };
            }
        }
        
        return {
            country: null,
            universityName: nameWithoutExt
        };
    }

    // Функция для организации существующих файлов в структуру R2
    async organizeFilesInR2() {
        const pageSlug = 'Our-partners.html';
        
        const confirmed = confirm(
            '⚠️ ВНИМАНИЕ: Это переместит файлы в R2 в структуру OurPartners/Страна/Университет.pdf\n\n' +
            'Для каждого документа будет создан новый путь на основе страны.\n\n' +
            'Продолжить?'
        );
        
        if (!confirmed) return;
        
        try {
            this.toggleLoading(true);
            this.showToast('info', 'Начинаю организацию файлов в R2...');
            
            // Получаем все вхождения для Our-partners
            const { data: usages, error: usagesError } = await supabase
                .from('document_usages')
                .select(`
                    id,
                    document_id,
                    country,
                    documents (
                        id,
                        file_name,
                        file_key,
                        file_url
                    )
                `)
                .eq('page_slug', pageSlug);
            
            if (usagesError) {
                throw new Error(`Ошибка загрузки вхождений: ${usagesError.message}`);
            }
            
            if (!usages || usages.length === 0) {
                this.showToast('warning', 'Не найдено вхождений для организации');
                return;
            }
            
            let organized = 0;
            let skipped = 0;
            let errors = 0;
            
            for (const usage of usages) {
                const doc = usage.documents;
                if (!doc || !doc.file_key) {
                    skipped++;
                    continue;
                }
                
                const country = usage.country;
                if (!country) {
                    skipped++;
                    continue;
                }
                
                // Получаем новый путь
                const newPath = this.getR2PathForPartnerDocument(doc.file_name, country);
                
                // Если путь уже правильный, пропускаем
                if (doc.file_key === newPath || doc.file_key.startsWith(`Our-partners/${country.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}/`)) {
                    skipped++;
                    continue;
                }
                
                try {
                    // Копируем файл на новый путь через R2 Worker
                    // Примечание: это требует поддержки копирования в R2 Worker
                    // Если копирование не поддерживается, нужно будет загрузить файл заново
                    const response = await fetch(`${R2_WORKER_URL}/copy?from=${encodeURIComponent(doc.file_key)}&to=${encodeURIComponent(newPath)}`, {
                        method: 'POST'
                    });
                    
                    if (response.ok) {
                        // Обновляем file_key в базе данных
                        const { error: updateError } = await supabase
                            .from('documents')
                            .update({ 
                                file_key: newPath,
                                file_url: `${(R2_PUBLIC_URL || '').replace(/\/$/, '')}/${encodeURIComponent(newPath)}`
                            })
                            .eq('id', doc.id);
                        
                        if (updateError) {
                            console.error(`Ошибка обновления документа ${doc.id}:`, updateError);
                            errors++;
                        } else {
                            organized++;
                        }
                    } else {
                        // Если копирование не поддерживается, пропускаем
                        console.warn(`Копирование не поддерживается для ${doc.file_key}`);
                        skipped++;
                    }
                } catch (error) {
                    console.error(`Ошибка организации файла ${doc.file_name}:`, error);
                    errors++;
                }
            }
            
            // Обновляем данные
            await this.fetchAllData();
            
            this.showToast('success', 
                `Готово! Организовано: ${organized}, пропущено: ${skipped}, ошибок: ${errors}`
            );
            
        } catch (error) {
            console.error('Ошибка организации файлов:', error);
            this.showToast('error', `Ошибка: ${error.message}`);
        } finally {
            this.toggleLoading(false);
        }
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

