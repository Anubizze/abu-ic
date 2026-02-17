// Unified Admin Panel - управление всеми сущностями
const PDF_MAX_MB = 15;
const IMAGE_MAX_MB = 2;

class UnifiedAdmin {
    constructor() {
        this.entities = [];
        this.filteredEntities = [];
        this.filters = {
            type: '',
            country: '',
            status: '',
            pdf: '',
            search: ''
        };
        this.currentEditId = null;
        this.init();
    }

    getR2WorkerUrl() {
        const r2Config = window.R2_CONFIG || {};
        return r2Config.WORKER_URL || '/api/r2-upload';
    }

    getR2PublicBase() {
        const r2Config = window.R2_CONFIG || {};
        return r2Config.PUBLIC_URL || r2Config.IMAGES_PUBLIC_URL || 'https://pub-a797bdf4261e4c448d835644b30caa41.r2.dev';
    }

    buildR2PublicUrl(key) {
        const base = this.getR2PublicBase();
        if (!base || !key) return '';
        const encodedPath = key.split('/').map(s => encodeURIComponent(s)).join('/');
        return base + '/' + encodedPath;
    }

    getPdfPreviewUrl(pdfFileUrl, pdfFileKey) {
        if (pdfFileUrl && (pdfFileUrl.startsWith('http://') || pdfFileUrl.startsWith('https://'))) return pdfFileUrl;
        return this.buildR2PublicUrl(pdfFileKey || '');
    }

    getImagePreviewUrl(imageUrl, imageKey) {
        if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) return imageUrl;
        return this.buildR2PublicUrl(imageKey || '');
    }

    // Для our_partners передавать только country_en (английское имя) — путь в R2 всегда OurPartners/Switzerland/ и т.д.
    getPdfKeyPrefix(entityType, countryName = '') {
        const country = (countryName || 'Other').replace(/\s+/g, ' ').trim().replace(/\s+/g, '_');
        const prefixes = {
            our_partners: `OurPartners/${country}`,
            students_appendices: 'Students/regulation-in-Russian-language',
            teachers_documents: 'files',
            mschool_documents: 'pdf',
            brochure_documents: 'files',
            eramus_documents: 'files',
            for_foreign_students_documents: 'files'
        };
        return prefixes[entityType] || 'files';
    }

    getImageKeyPrefix(entityType, imageType = 'card') {
        if (imageType === 'flag') return 'img/our-partners-html';
        if (entityType === 'eramus_documents') return 'img/eramus-html';
        if (entityType === 'for_foreign_students_documents') return 'img/cards';
        return 'img';
    }

    async uploadFileToR2(file, key) {
        if (!file || file.size === 0) return null;
        const workerUrl = this.getR2WorkerUrl();
        if (!workerUrl) throw new Error('R2 WORKER_URL не задан. Проверьте js/r2-config.js');
        const response = await fetch(`${workerUrl}/upload?name=${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Загрузка в R2 не удалась: ${response.status} ${err}`);
        }
        let payload = null;
        try { payload = await response.json(); } catch (_) {}
        let url = payload?.url;
        if (!url) url = this.buildR2PublicUrl(key);
        if (!url) throw new Error('R2 не вернул URL файла. Проверь переменную PUBLIC_BASE_URL в настройках Worker.');
        return url;
    }

    esc(v) {
        if (v == null || v === '') return '';
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async init() {
        this.setupEventListeners();
        
        // Ждём инициализации Supabase
        if (typeof window.supabase === 'undefined' || !window.supabase) {
            console.log('Ожидание инициализации Supabase...');
            await this.waitForSupabase(3000);
        }
        
        // Загружаем сущности
        await this.loadEntities();
        this.applyFilters();
    }

    setupEventListeners() {
        // Фильтры
        const entityTypeFilter = document.getElementById('entityTypeFilter');
        if (entityTypeFilter) {
            entityTypeFilter.addEventListener('change', (e) => {
                this.filters.type = e.target.value;
                this.updateCountryFilter();
                this.applyFilters();
            });
        }

        const countryFilter = document.getElementById('countryFilter');
        if (countryFilter) {
            countryFilter.addEventListener('change', (e) => {
                this.filters.country = e.target.value;
                this.applyFilters();
            });
        }

        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
            });
        }

        const pdfFilter = document.getElementById('pdfFilter');
        if (pdfFilter) {
            pdfFilter.addEventListener('change', (e) => {
                this.filters.pdf = e.target.value;
                this.applyFilters();
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }

        // Кнопка добавления
        const addBtn = document.getElementById('addEntityBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.openAddModal();
            });
        }

        // Кнопка обновления
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadEntities();
                this.applyFilters();
            });
        }

        // Модальное окно
        const closeModalBtn = document.getElementById('closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        const entityForm = document.getElementById('entityForm');
        if (entityForm) {
            entityForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit(e);
            });
        }
    }

    async waitForSupabase(maxWait = 5000) {
        const startTime = Date.now();
        while (typeof window.supabase === 'undefined' || !window.supabase) {
            if (Date.now() - startTime > maxWait) {
                throw new Error('Supabase не инициализирован в течение ' + maxWait + 'мс');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async loadEntities() {
        try {
            if (typeof window.supabase === 'undefined' || !window.supabase) {
                await this.waitForSupabase();
            }

            // Загружаем все типы сущностей
            const entityTypes = [
                'our_partners',
                'students_appendices',
                'teachers_documents',
                'mschool_documents',
                'brochure_documents',
                'eramus_documents',
                'for_foreign_students_documents'
            ];

            const allEntities = [];

            for (const type of entityTypes) {
                try {
                    const { data, error } = await window.supabase
                        .from(type)
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.warn(`Ошибка загрузки ${type}:`, error);
                        continue;
                    }

                    if (data) {
                        data.forEach(item => {
                            allEntities.push({
                                ...item,
                                entity_type: type
                            });
                        });
                    }
                } catch (err) {
                    console.warn(`Ошибка при загрузке ${type}:`, err);
                }
            }

            this.entities = allEntities;
            console.log('Загружено сущностей:', this.entities.length);
        } catch (error) {
            console.error('Ошибка загрузки сущностей:', error);
            this.showNotification('Ошибка загрузки сущностей: ' + error.message, 'error');
            this.entities = [];
        }
    }

    updateCountryFilter() {
        const countryFilterGroup = document.getElementById('countryFilterGroup');
        const countryFilter = document.getElementById('countryFilter');
        
        if (!countryFilterGroup || !countryFilter) return;

        // Показываем фильтр страны только для партнеров
        if (this.filters.type === 'our_partners') {
            countryFilterGroup.style.display = 'flex';
            
            // Получаем уникальные страны
            const countries = [...new Set(
                this.entities
                    .filter(e => e.entity_type === 'our_partners' && e.country_ru)
                    .map(e => e.country_ru)
            )].sort();

            countryFilter.innerHTML = '<option value="">Все страны</option>';
            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countryFilter.appendChild(option);
            });
        } else {
            countryFilterGroup.style.display = 'none';
            countryFilter.value = '';
            this.filters.country = '';
        }
    }

    applyFilters() {
        this.filteredEntities = this.entities.filter(entity => {
            // Фильтр по типу
            if (this.filters.type && entity.entity_type !== this.filters.type) {
                return false;
            }

            // Фильтр по стране (только для партнеров)
            if (this.filters.country && entity.country_ru !== this.filters.country) {
                return false;
            }

            // Фильтр по статусу
            if (this.filters.status) {
                const isActive = entity.is_active !== false;
                if (this.filters.status === 'true' && !isActive) return false;
                if (this.filters.status === 'false' && isActive) return false;
            }

            // Фильтр по PDF
            if (this.filters.pdf) {
                const pdfUrl = entity.pdf_url || entity.file_url || entity.pdf_file_url || null;
                const hasPdf = !!pdfUrl;
                if (this.filters.pdf === 'has' && !hasPdf) return false;
                if (this.filters.pdf === 'no' && hasPdf) return false;
            }

            // Поиск
            if (this.filters.search) {
                const searchText = this.filters.search;
                const titleRu = (entity.title_ru || entity.university_name_ru || '').toLowerCase();
                const titleEn = (entity.title_en || entity.university_name_en || '').toLowerCase();
                const titleKz = (entity.title_kz || entity.university_name_kz || '').toLowerCase();
                const descriptionRu = (entity.description_ru || '').toLowerCase();
                if (!titleRu.includes(searchText) && !titleEn.includes(searchText) &&
                    !titleKz.includes(searchText) && !descriptionRu.includes(searchText)) {
                    return false;
                }
            }

            return true;
        });

        this.renderEntities();
        this.updateStats();
    }

    renderEntities() {
        const entitiesList = document.getElementById('entitiesList');
        if (!entitiesList) return;

        if (this.filteredEntities.length === 0) {
            entitiesList.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 50px; color: #666;">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px; color: #ccc;"></i>
                    <p>Сущностей не найдено</p>
                </div>
            `;
            return;
        }

        const entitiesHTML = this.filteredEntities.map(entity => this.createEntityCard(entity)).join('');
        entitiesList.innerHTML = entitiesHTML;

        // Привязываем обработчики
        this.attachCardEventListeners();
    }

    createEntityCard(entity) {
        const typeNames = {
            'our_partners': 'Наши партнеры',
            'students_appendices': 'Студенты',
            'teachers_documents': 'Преподаватели',
            'mschool_documents': 'MSchool',
            'brochure_documents': 'Брошюры',
            'eramus_documents': 'Академическая мобильность',
            'for_foreign_students_documents': 'Иностранным студентам'
        };

        const typeName = typeNames[entity.entity_type] || entity.entity_type;
        const title = entity.title_ru || entity.university_name_ru || 'Без названия';
        const statusClass = entity.is_active !== false ? 'active' : 'inactive';
        // Проверяем все возможные поля для PDF в зависимости от типа сущности
        let pdfUrl = null;
        if (entity.entity_type === 'our_partners') {
            // Для партнеров используется pdf_file_url
            pdfUrl = entity.pdf_file_url || entity.pdf_url || entity.file_url || null;
        } else {
            // Для остальных типов проверяем все поля
            pdfUrl = entity.pdf_file_url || entity.pdf_url || entity.file_url || null;
        }
        const hasPdf = !!pdfUrl;

        return `
            <div class="entity-card ${statusClass}" data-entity-id="${entity.id}" data-entity-type="${entity.entity_type}">
                <div class="entity-card-header">
                    <div>
                        <div class="entity-card-title">${title}</div>
                        <div class="entity-card-meta">
                            <span class="entity-type-badge ${entity.entity_type}">${typeName}</span>
                            <span class="pdf-badge ${hasPdf ? 'has-pdf' : 'no-pdf'}">
                                ${hasPdf ? '✓ PDF' : '✗ Нет PDF'}
                            </span>
                            ${entity.country_ru ? `<span>${entity.country_ru}</span>` : ''}
                            ${pdfUrl ? `<a href="${pdfUrl}" target="_blank" rel="noopener" class="pdf-link" style="color: #2a5298; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-file-pdf"></i> Открыть PDF</a>` : ''}
                        </div>
                    </div>
                    <div class="entity-card-actions">
                        <button class="btn btn-sm btn-primary edit-entity-btn" data-entity-id="${entity.id}">
                            <i class="fas fa-edit"></i> Редактировать
                        </button>
                        <button class="btn btn-sm btn-danger delete-entity-btn" data-entity-id="${entity.id}">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    attachCardEventListeners() {
        document.querySelectorAll('.edit-entity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entityId = e.target.closest('.edit-entity-btn').getAttribute('data-entity-id');
                const card = e.target.closest('.entity-card');
                const entityType = card.getAttribute('data-entity-type');
                this.editEntity(entityId, entityType);
            });
        });

        document.querySelectorAll('.delete-entity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entityId = e.target.closest('.delete-entity-btn').getAttribute('data-entity-id');
                const card = e.target.closest('.entity-card');
                const entityType = card.getAttribute('data-entity-type');
                this.deleteEntity(entityId, entityType);
            });
        });
    }

    updateStats() {
        const total = this.filteredEntities.length;
        const active = this.filteredEntities.filter(e => e.is_active !== false).length;
        const inactive = total - active;

        const totalCount = document.getElementById('totalCount');
        const activeCount = document.getElementById('activeCount');
        const inactiveCount = document.getElementById('inactiveCount');

        if (totalCount) totalCount.textContent = total;
        if (activeCount) activeCount.textContent = active;
        if (inactiveCount) inactiveCount.textContent = inactive;
    }

    openAddModal() {
        const modal = document.getElementById('entityModal');
        const modalTitle = document.getElementById('modalTitle');
        const entityType = document.getElementById('entityTypeFilter').value;

        if (!entityType) {
            this.showNotification('Выберите тип сущности перед добавлением', 'error');
            return;
        }

        if (modalTitle) modalTitle.textContent = 'Добавить сущность';
        if (modal) {
            modal.style.display = 'flex';
            document.body.classList.add('modal-open');
        }
        this.currentEditId = null;
        this.renderEntityForm(entityType);
    }

    editEntity(entityId, entityType) {
        const entity = this.entities.find(e => e.id === entityId && e.entity_type === entityType);
        if (!entity) {
            this.showNotification('Сущность не найдена', 'error');
            return;
        }

        const modal = document.getElementById('entityModal');
        const modalTitle = document.getElementById('modalTitle');
        
        if (modalTitle) modalTitle.textContent = 'Редактировать сущность';
        if (modal) {
            modal.style.display = 'flex';
            document.body.classList.add('modal-open');
        }
        this.currentEditId = entityId;
        this.renderEntityForm(entityType, entity);
    }

    renderEntityForm(entityType, entity = null) {
        const formFields = document.getElementById('entityFormFields');
        if (!formFields) return;

        const entityIdInput = document.getElementById('entityId');
        const entityTypeInput = document.getElementById('entityType');
        if (entityIdInput) entityIdInput.value = entity?.id || '';
        if (entityTypeInput) entityTypeInput.value = entityType;

        const isPartner = entityType === 'our_partners';
        const hasCard = entityType === 'eramus_documents' || entityType === 'for_foreign_students_documents';
        const pdfRequired = !isPartner;

        const titleRu = this.esc(entity?.title_ru || entity?.university_name_ru || '');
        const titleKz = this.esc(entity?.title_kz || entity?.university_name_kz || '');
        const titleEn = this.esc(entity?.title_en || entity?.university_name_en || '');
        const descRu = this.esc(entity?.description_ru || '');
        const descKz = this.esc(entity?.description_kz || '');
        const descEn = this.esc(entity?.description_en || '');
        const countryRu = this.esc(entity?.country_ru || '');
        const countryKz = this.esc(entity?.country_kz || '');
        const countryEn = this.esc(entity?.country_en || '');
        const pdfUrl = this.esc(entity?.pdf_file_url || entity?.pdf_url || entity?.file_url || '');
        const websiteUrl = this.esc(entity?.website_url || '');
        const flagUrl = this.esc(entity?.flag_image_url || '');
        const cardUrl = this.esc(entity?.card_image_url || '');
        const pdfPreview = this.getPdfPreviewUrl(entity?.pdf_file_url || entity?.pdf_url || entity?.file_url, entity?.pdf_file_key);
        const flagPreview = this.getImagePreviewUrl(entity?.flag_image_url, entity?.flag_image_key);
        const cardPreview = this.getImagePreviewUrl(entity?.card_image_url, entity?.card_image_key);

        formFields.innerHTML = `
            <div class="entity-form-unified">
                <div class="form-section">
                    <h3 class="form-section-title">Основные данные</h3>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Название (RU) *</label>
                            <input type="text" name="title_ru" value="${titleRu}" required placeholder="Название на русском">
                        </div>
                        <div class="form-group">
                            <label>Название (KZ)</label>
                            <input type="text" name="title_kz" value="${titleKz}" placeholder="Атауы (қазақша)">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Название (EN)</label>
                        <input type="text" name="title_en" value="${titleEn}" placeholder="Title (English)">
                    </div>
                    ${isPartner ? `
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Страна (RU)</label>
                            <input type="text" name="country_ru" value="${countryRu}" placeholder="Россия">
                        </div>
                        <div class="form-group">
                            <label>Страна (KZ)</label>
                            <input type="text" name="country_kz" value="${countryKz}" placeholder="Ресей">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Страна (EN)</label>
                        <input type="text" name="country_en" value="${countryEn}" placeholder="Russia">
                    </div>
                    ` : ''}
                    ${!isPartner ? `
                    <div class="form-group">
                        <label>Описание (RU)</label>
                        <textarea name="description_ru" rows="2" placeholder="Краткое описание">${descRu}</textarea>
                    </div>
                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Описание (KZ)</label>
                            <textarea name="description_kz" rows="2" placeholder="Сипаттама">${descKz}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Описание (EN)</label>
                            <textarea name="description_en" rows="2" placeholder="Description">${descEn}</textarea>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <div class="form-section">
                    <h3 class="form-section-title">PDF документ</h3>
                    <small class="form-hint">${isPartner ? 'Для партнёров PDF необязателен — можно добавить только ссылку на сайт.' : 'Обязательно: укажите URL или загрузите файл (до 15 МБ).'}</small>
                    <div class="form-group">
                        <label>URL файла (если уже загружен)</label>
                        <input type="url" name="pdf_url" value="${pdfUrl}" placeholder="https://...r2.dev/.../file.pdf">
                    </div>
                    <div class="form-group">
                        <label>Или загрузить PDF с компьютера</label>
                        <div class="file-upload-zone" id="pdfUploadZone">
                            <input type="file" name="pdf_file" id="pdfFileInput" accept=".pdf,application/pdf">
                            <div class="file-upload-preview" id="pdfPreview">
                                <i class="fas fa-file-pdf"></i>
                                <span id="pdfPreviewText">Выберите PDF (до 15 МБ)</span>
                                ${pdfPreview ? `<a href="${this.esc(pdfPreview)}" target="_blank" class="current-file-link">Текущий PDF</a>` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                ${isPartner ? `
                <div class="form-section">
                    <h3 class="form-section-title">Сайт и флаг (только для партнёров)</h3>
                    <div class="form-group">
                        <label>Ссылка на сайт университета</label>
                        <input type="url" name="website_url" value="${websiteUrl}" placeholder="https://university.edu">
                    </div>
                    <div class="form-group">
                        <label>Изображение флага (URL)</label>
                        <input type="url" name="flag_image_url" value="${flagUrl}" placeholder="https://...r2.dev/img/...">
                    </div>
                    <div class="form-group">
                        <label>Или загрузить флаг</label>
                        <div class="file-upload-zone" id="flagUploadZone">
                            <input type="file" name="flag_image_file" id="flagFileInput" accept=".jpg,.jpeg,.png,.webp">
                            <div class="file-upload-preview" id="flagPreview">
                                <i class="fas fa-image"></i>
                                <span id="flagPreviewText">Выберите изображение (до 2 МБ)</span>
                                ${flagPreview ? `<img src="${this.esc(flagPreview)}" alt="Флаг" class="preview-thumb" onerror="this.style.display='none'">` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${hasCard ? `
                <div class="form-section">
                    <h3 class="form-section-title">Изображение карточки</h3>
                    <div class="form-group">
                        <label>URL изображения</label>
                        <input type="url" name="card_image_url" value="${cardUrl}" placeholder="https://...r2.dev/img/...">
                    </div>
                    <div class="form-group">
                        <label>Или загрузить изображение</label>
                        <div class="file-upload-zone" id="cardUploadZone">
                            <input type="file" name="card_image_file" id="cardFileInput" accept=".jpg,.jpeg,.png,.webp">
                            <div class="file-upload-preview" id="cardPreview">
                                <i class="fas fa-image"></i>
                                <span id="cardPreviewText">Выберите изображение (до 2 МБ)</span>
                                ${cardPreview ? `<img src="${this.esc(cardPreview)}" alt="Карточка" class="preview-thumb" onerror="this.style.display='none'">` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="form-section">
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" name="is_active" ${entity?.is_active !== false ? 'checked' : ''}>
                            <span>Активна</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        this.setupFileUploadListeners(entityType);
        if (pdfRequired) {
            const pdfInput = formFields.querySelector('input[name="pdf_url"]');
            const pdfFileInput = formFields.querySelector('#pdfFileInput');
            if (pdfInput && pdfFileInput) {
                const validatePdf = () => {
                    const hasUrl = pdfInput.value.trim().length > 0;
                    const hasFile = pdfFileInput.files && pdfFileInput.files.length > 0;
                    pdfInput.setCustomValidity(hasUrl || hasFile ? '' : 'Укажите URL или загрузите PDF');
                };
                pdfInput.addEventListener('input', validatePdf);
                pdfFileInput.addEventListener('change', validatePdf);
                validatePdf();
            }
        }
    }

    setupFileUploadListeners(entityType) {
        const pdfInput = document.getElementById('pdfFileInput');
        const pdfPreview = document.getElementById('pdfPreview');
        const pdfPreviewText = document.getElementById('pdfPreviewText');
        if (pdfInput && pdfPreviewText) {
            pdfInput.addEventListener('change', () => {
                const f = pdfInput.files?.[0];
                if (f) {
                    if (f.size > PDF_MAX_MB * 1024 * 1024) {
                        this.showNotification(`PDF не должен превышать ${PDF_MAX_MB} МБ`, 'error');
                        pdfInput.value = '';
                        pdfPreviewText.textContent = 'Выберите PDF (до 15 МБ)';
                        return;
                    }
                    pdfPreviewText.textContent = f.name + ' (' + (f.size / 1024).toFixed(1) + ' КБ)';
                } else {
                    pdfPreviewText.textContent = 'Выберите PDF (до 15 МБ)';
                }
            });
        }

        const flagInput = document.getElementById('flagFileInput');
        const flagPreviewText = document.getElementById('flagPreviewText');
        if (flagInput && flagPreviewText) {
            flagInput.addEventListener('change', () => {
                const f = flagInput.files?.[0];
                if (f) {
                    if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
                        this.showNotification(`Изображение не должно превышать ${IMAGE_MAX_MB} МБ`, 'error');
                        flagInput.value = '';
                        flagPreviewText.textContent = 'Выберите изображение (до 2 МБ)';
                        return;
                    }
                    flagPreviewText.textContent = f.name;
                } else {
                    flagPreviewText.textContent = 'Выберите изображение (до 2 МБ)';
                }
            });
        }

        const cardInput = document.getElementById('cardFileInput');
        const cardPreviewText = document.getElementById('cardPreviewText');
        if (cardInput && cardPreviewText) {
            cardInput.addEventListener('change', () => {
                const f = cardInput.files?.[0];
                if (f) {
                    if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
                        this.showNotification(`Изображение не должно превышать ${IMAGE_MAX_MB} МБ`, 'error');
                        cardInput.value = '';
                        cardPreviewText.textContent = 'Выберите изображение (до 2 МБ)';
                        return;
                    }
                    cardPreviewText.textContent = f.name;
                } else {
                    cardPreviewText.textContent = 'Выберите изображение (до 2 МБ)';
                }
            });
        }
    }

    async handleSubmit(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && submitBtn.disabled) return;

        const formData = new FormData(form);
        const entityType = formData.get('entity_type');
        const entityId = formData.get('entity_id');
        const isPartner = entityType === 'our_partners';
        const hasCard = entityType === 'eramus_documents' || entityType === 'for_foreign_students_documents';

        try {
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
                submitBtn.disabled = true;
            }

            let pdfUrl = (formData.get('pdf_url') || '').trim() || null;
            let pdfKey = null;
            const pdfFile = form.querySelector('#pdfFileInput')?.files?.[0];
            if (pdfFile && pdfFile.size > 0) {
                let prefix;
                if (entityType === 'our_partners') {
                    const countryEn = (formData.get('country_en') || '').trim();
                    if (!countryEn) throw new Error('Поле «Страна (EN)» обязательно для загрузки PDF партнёра. Укажите страну на английском (например Switzerland).');
                    prefix = this.getPdfKeyPrefix(entityType, countryEn);
                } else {
                    prefix = this.getPdfKeyPrefix(entityType, '');
                }
                const ext = (pdfFile.name.split('.').pop() || 'pdf').toLowerCase();
                pdfKey = `${prefix}/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
                pdfUrl = await this.uploadFileToR2(pdfFile, pdfKey);
            } else if (pdfUrl) {
                pdfKey = this.urlToKey(pdfUrl);
            }

            if (!isPartner && !pdfUrl) {
                throw new Error('Укажите URL PDF или загрузите файл');
            }
            // #region agent log
            fetch('http://127.0.0.1:7246/ingest/0e1bcba3-60e2-4f65-a79b-e540dc633b7e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-unified.js:afterUpload',message:'after R2 upload',data:{pdfUrl: pdfUrl ? pdfUrl.substring(0,80)+'...' : pdfUrl,pdfKey,isPartner,entityType,hasPdfFile:!!(pdfFile&&pdfFile.size>0)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
            // #endregion

            let flagUrl = (formData.get('flag_image_url') || '').trim() || null;
            let flagKey = null;
            const flagFile = form.querySelector('#flagFileInput')?.files?.[0];
            if (flagFile && flagFile.size > 0) {
                const prefix = this.getImageKeyPrefix(entityType, 'flag');
                const ext = (flagFile.name.split('.').pop() || 'jpg').toLowerCase();
                flagKey = `${prefix}/flag_${Date.now()}.${ext}`;
                flagUrl = await this.uploadFileToR2(flagFile, flagKey);
            } else if (flagUrl) {
                flagKey = this.urlToKey(flagUrl);
            }

            let cardUrl = (formData.get('card_image_url') || '').trim() || null;
            let cardKey = null;
            const cardFile = form.querySelector('#cardFileInput')?.files?.[0];
            if (cardFile && cardFile.size > 0) {
                const prefix = this.getImageKeyPrefix(entityType, 'card');
                const ext = (cardFile.name.split('.').pop() || 'jpg').toLowerCase();
                cardKey = `${prefix}/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
                cardUrl = await this.uploadFileToR2(cardFile, cardKey);
            } else if (cardUrl) {
                cardKey = this.urlToKey(cardUrl);
            }

            const isUpdate = Boolean(entityId);

            let entityData;
            if (entityType === 'our_partners') {
                entityData = {
                    university_name_ru: formData.get('title_ru') || null,
                    university_name_kz: formData.get('title_kz') || null,
                    university_name_en: formData.get('title_en') || null,
                    country_ru: formData.get('country_ru') || null,
                    country_kz: formData.get('country_kz') || null,
                    country_en: formData.get('country_en') || null,
                    website_url: (formData.get('website_url') || '').trim() || null,
                    description_ru: null,
                    description_kz: null,
                    description_en: null,
                    is_active: formData.get('is_active') === 'on'
                };
                if (pdfUrl != null) {
                    entityData.pdf_file_url = pdfUrl;
                    entityData.pdf_file_key = pdfKey;
                    entityData.r2_file_name = pdfKey;
                } else {
                    entityData.pdf_file_url = null;
                    entityData.pdf_file_key = null;
                    entityData.r2_file_name = null;
                }
                if (flagUrl != null) {
                    entityData.flag_image_url = flagUrl;
                    entityData.flag_image_key = flagKey;
                } else {
                    entityData.flag_image_url = null;
                    entityData.flag_image_key = null;
                }
            }
            // #region agent log
            if (entityType === 'our_partners') {
                fetch('http://127.0.0.1:7246/ingest/0e1bcba3-60e2-4f65-a79b-e540dc633b7e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-unified.js:entityDataBuilt',message:'entityData for our_partners',data:{hasPdfFileUrl:'pdf_file_url' in entityData && entityData.pdf_file_url != null,pdf_file_url: entityData.pdf_file_url ? String(entityData.pdf_file_url).substring(0,90)+'...' : entityData.pdf_file_url,pdf_file_key: entityData.pdf_file_key,keys:Object.keys(entityData)},timestamp:Date.now(),hypothesisId:'H1,H2'})}).catch(()=>{});
            }
            // #endregion
            if (entityType !== 'our_partners') {
                entityData = {
                    title_ru: formData.get('title_ru') || null,
                    title_kz: formData.get('title_kz') || null,
                    title_en: formData.get('title_en') || null,
                    description_ru: formData.get('description_ru') || null,
                    description_kz: formData.get('description_kz') || null,
                    description_en: formData.get('description_en') || null,
                    is_active: formData.get('is_active') === 'on'
                };
                if (pdfUrl != null) {
                    entityData.pdf_file_url = pdfUrl;
                    entityData.pdf_file_key = pdfKey;
                    entityData.r2_file_name = pdfKey;
                } else {
                    entityData.pdf_file_url = null;
                    entityData.pdf_file_key = null;
                    entityData.r2_file_name = null;
                }
                if (entityType === 'eramus_documents' || entityType === 'for_foreign_students_documents') {
                    if (cardUrl != null) {
                        entityData.card_image_url = cardUrl;
                        entityData.card_image_key = cardKey;
                    } else {
                        entityData.card_image_url = null;
                        entityData.card_image_key = null;
                    }
                }
            }

            if (!entityId) {
                const { data: max } = await window.supabase.from(entityType).select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
                entityData.sort_order = (max?.sort_order ?? -1) + 1;
            }

            // Если только что загрузили PDF — в entityData обязан быть pdf_file_url
            const didUploadPdf = pdfFile && pdfFile.size > 0;
            if (didUploadPdf && (!entityData.pdf_file_url || !entityData.pdf_file_key)) {
                throw new Error('Ошибка: после загрузки PDF URL не попал в данные. Обновите страницу и попробуйте снова.');
            }

            // #region agent log
            fetch('http://127.0.0.1:7246/ingest/0e1bcba3-60e2-4f65-a79b-e540dc633b7e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-unified.js:beforeSupabase',message:'payload before Supabase',data:{entityId,entityType,hasPdfFileUrl:'pdf_file_url' in entityData && entityData.pdf_file_url != null,pdf_file_url_len:entityData.pdf_file_url ? String(entityData.pdf_file_url).length : 0,payloadKeys:Object.keys(entityData)},timestamp:Date.now(),hypothesisId:'H2,H5'})}).catch(()=>{});
            // #endregion
            let result;
            if (entityId) {
                result = await window.supabase.from(entityType).update(entityData).eq('id', entityId).select('id, pdf_file_url, pdf_file_key');
            } else {
                result = await window.supabase.from(entityType).insert([entityData]).select('id, pdf_file_url, pdf_file_key');
            }
            // #region agent log
            const row = result.data && (Array.isArray(result.data) ? result.data[0] : result.data);
            fetch('http://127.0.0.1:7246/ingest/0e1bcba3-60e2-4f65-a79b-e540dc633b7e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-unified.js:afterSupabase',message:'Supabase result',data:{error: result.error ? String(result.error.message || result.error) : null,status: result.status,dataLength: result.data ? (Array.isArray(result.data)?result.data.length:1) : 0,returnedPdfUrl: row ? (row.pdf_file_url != null ? String(row.pdf_file_url).substring(0,80)+'...' : row.pdf_file_url) : undefined,returnedPdfKey: row ? row.pdf_file_key : undefined},timestamp:Date.now(),hypothesisId:'H3,H4,H6'})}).catch(()=>{});
            // #endregion
            if (result.error) throw result.error;

            this.showNotification(entityId ? 'Сущность обновлена!' : 'Сущность добавлена!', 'success');
            this.closeModal();
            await this.loadEntities();
            this.applyFilters();

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.showNotification('Ошибка: ' + error.message, 'error');
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
                submitBtn.disabled = false;
            }
        }
    }

    urlToKey(url) {
        if (!url) return null;
        const base = this.getR2PublicBase();
        if (url.startsWith(base + '/')) {
            return decodeURIComponent(url.slice(base.length + 1));
        }
        try {
            const u = new URL(url);
            const path = u.pathname.replace(/^\/+/, '');
            return decodeURIComponent(path) || null;
        } catch (_) {
            return null;
        }
    }

    async deleteEntity(entityId, entityType) {
        const entity = this.entities.find(e => e.id === entityId && e.entity_type === entityType);
        if (!entity) {
            this.showNotification('Сущность не найдена', 'error');
            return;
        }

        const title = entity.title_ru || entity.university_name_ru || 'Без названия';
        if (!confirm(`Вы уверены, что хотите удалить "${title}"?`)) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from(entityType)
                .delete()
                .eq('id', entityId);

            if (error) {
                throw error;
            }

            this.showNotification('Сущность успешно удалена!', 'success');
            await this.loadEntities();
            this.applyFilters();
        } catch (error) {
            console.error('Ошибка удаления сущности:', error);
            this.showNotification('Ошибка при удалении: ' + error.message, 'error');
        }
    }

    closeModal() {
        const modal = document.getElementById('entityModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        this.currentEditId = null;
    }

    showNotification(message, type = 'info') {
        let notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notificationContainer';
            notificationContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
            document.body.appendChild(notificationContainer);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
        `;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="close-notification" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer; padding: 0; width: 20px; height: 20px;">
                <i class="fas fa-times"></i>
            </button>
        `;
        notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        notification.querySelector('.close-notification').addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        });
    }
}

// Инициализация админки после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    await window.ABU_ADMIN_AUTH?.guardAdminPage();
    window.unifiedAdmin = new UnifiedAdmin();
});

