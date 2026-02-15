// Unified Admin Panel - управление всеми сущностями
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
                const titleRu = (entity.title_ru || '').toLowerCase();
                const titleEn = (entity.title_en || '').toLowerCase();
                const titleKz = (entity.title_kz || '').toLowerCase();
                const descriptionRu = (entity.description_ru || '').toLowerCase();
                
                if (!titleRu.includes(searchText) && 
                    !titleEn.includes(searchText) && 
                    !titleKz.includes(searchText) &&
                    !descriptionRu.includes(searchText)) {
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

        // Простая форма (можно расширить)
        formFields.innerHTML = `
            <div class="form-group">
                <label>Название (RU) *</label>
                <input type="text" name="title_ru" value="${entity?.title_ru || entity?.university_name_ru || ''}" required>
            </div>
            <div class="form-group">
                <label>Описание (RU)</label>
                <textarea name="description_ru" rows="3">${entity?.description_ru || ''}</textarea>
            </div>
            ${entityType === 'our_partners' ? `
                <div class="form-group">
                    <label>Страна (RU)</label>
                    <input type="text" name="country_ru" value="${entity?.country_ru || ''}">
                </div>
            ` : ''}
            <div class="form-group">
                <label>PDF URL *</label>
                <input type="url" name="pdf_url" value="${entity?.pdf_url || entity?.file_url || entity?.pdf_file_url || ''}" required>
                <small style="color: #666; display: block; margin-top: 4px;">URL PDF файла (обязательно для большинства типов сущностей)</small>
            </div>
            <div class="form-group checkbox-group">
                <label>
                    <input type="checkbox" name="is_active" ${entity?.is_active !== false ? 'checked' : ''}>
                    <span>Активна</span>
                </label>
            </div>
        `;
    }

    async handleSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const entityType = formData.get('entity_type');
        const entityId = formData.get('entity_id');

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            submitBtn.disabled = true;

            const pdfUrl = formData.get('pdf_url') || null;
            
            const entityData = {
                title_ru: formData.get('title_ru'),
                description_ru: formData.get('description_ru') || null,
                is_active: formData.get('is_active') === 'on'
            };

            // Сохраняем PDF URL в правильное поле в зависимости от типа сущности
            if (entityType === 'our_partners') {
                entityData.country_ru = formData.get('country_ru') || null;
                entityData.university_name_ru = formData.get('title_ru');
                entityData.pdf_url = pdfUrl;
            } else if (entityType === 'students_appendices' || entityType === 'teachers_documents' || 
                       entityType === 'mschool_documents' || entityType === 'brochure_documents' ||
                       entityType === 'eramus_documents' || entityType === 'for_foreign_students_documents') {
                // Для этих типов может использоваться pdf_file_url или file_url
                entityData.pdf_file_url = pdfUrl;
                entityData.file_url = pdfUrl;
            } else {
                entityData.pdf_url = pdfUrl;
            }

            let result;
            if (entityId) {
                result = await window.supabase
                    .from(entityType)
                    .update(entityData)
                    .eq('id', entityId);
            } else {
                result = await window.supabase
                    .from(entityType)
                    .insert([entityData]);
            }

            if (result.error) {
                throw result.error;
            }

            this.showNotification(entityId ? 'Сущность успешно обновлена!' : 'Сущность успешно добавлена!', 'success');
            this.closeModal();
            
            await this.loadEntities();
            this.applyFilters();

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка сохранения сущности:', error);
            this.showNotification('Ошибка при сохранении: ' + error.message, 'error');
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
            submitBtn.disabled = false;
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

