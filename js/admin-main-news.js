// Админ-панель новостей главной страницы
class MainNewsAdmin {
    constructor() {
        this.news = [];
        this.currentEditId = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupImageUpload();
        this.setupLanguageTabs();
        
        // Ждём инициализации Supabase
        if (typeof window.supabase === 'undefined' || !window.supabase) {
            console.log('Ожидание инициализации Supabase...');
            await this.waitForSupabase(3000);
        }
        
        // Загружаем новости
        await this.loadNews();
        this.renderNewsList();
    }

    setupEventListeners() {
        // Форма добавления новости
        const newsForm = document.getElementById('mainNewsForm');
        if (newsForm) {
            newsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit(e);
            });
        }

        // Форма редактирования
        const editForm = document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleEditSubmit(e);
            });
        }

        // Кнопка отмены редактирования
        const cancelEditBtn = document.getElementById('cancelEdit');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                document.getElementById('editModal').style.display = 'none';
                this.currentEditId = null;
            });
        }

        // Кнопка обновления списка
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const originalText = refreshBtn.innerHTML;
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
                
                try {
                    await this.loadNews();
                    this.renderNewsList();
                } finally {
                    refreshBtn.innerHTML = originalText;
                    refreshBtn.disabled = false;
                }
            });
        }

        // Модальные окна
        this.setupModalListeners();
    }

    setupImageUpload() {
        const imageInput = document.getElementById('mainNewsImage');
        const imagePreview = document.getElementById('mainNewsImagePreview');
        const imageUrlInput = document.getElementById('mainNewsImageUrl');

        if (imageInput && imagePreview) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.previewImage(file, imagePreview);
                }
            });
        }

        if (imageUrlInput) {
            imageUrlInput.addEventListener('input', (e) => {
                this.handleImageUrlChange(e);
            });
        }

        // Для редактирования
        const editImageInput = document.getElementById('editImage');
        const editImagePreview = document.getElementById('editImagePreview');
        if (editImageInput && editImagePreview) {
            editImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.previewImage(file, editImagePreview);
                }
            });
        }
    }

    previewImage(file, previewElement) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewElement.innerHTML = `
                <img src="${e.target.result}" alt="Предварительный просмотр" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                <span style="display: block; margin-top: 8px; color: #666;">${file.name}</span>
            `;
            previewElement.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }

    handleImageUrlChange(e) {
        const url = e.target.value;
        const imagePreview = document.getElementById('mainNewsImagePreview');
        
        if (!imagePreview) return;

        if (url) {
            const img = new Image();
            img.onload = () => {
                imagePreview.innerHTML = `
                    <img src="${url}" alt="Предварительный просмотр" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                    <span style="display: block; margin-top: 8px; color: #666;">Изображение по URL</span>
                `;
                imagePreview.classList.add('has-image');
            };
            img.onerror = () => {
                imagePreview.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Не удалось загрузить изображение</span>
                `;
                imagePreview.classList.remove('has-image');
            };
            img.src = url;
        } else {
            imagePreview.innerHTML = `
                <i class="fas fa-image"></i>
                <span>Выберите изображение (опционально)</span>
            `;
            imagePreview.classList.remove('has-image');
        }
    }

    setupLanguageTabs() {
        // Инициализируем табы для формы добавления
        this.initLanguageTabs(document.getElementById('mainNewsForm'));
        // Инициализируем табы для формы редактирования
        this.initLanguageTabs(document.getElementById('editForm'));
    }

    initLanguageTabs(formElement) {
        if (!formElement) return;

        const multilangSection = formElement.querySelector('.multilang-section');
        if (!multilangSection) return;

        const langTabs = multilangSection.querySelectorAll('.lang-tab');
        langTabs.forEach(tab => {
            // Удаляем старые обработчики если есть
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
            
            newTab.addEventListener('click', () => {
                const lang = newTab.getAttribute('data-lang');
                
                // Убираем активный класс со всех вкладок и панелей
                multilangSection.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
                multilangSection.querySelectorAll('.lang-panel').forEach(p => p.classList.remove('active'));
                
                // Добавляем активный класс к выбранной вкладке и панели
                newTab.classList.add('active');
                const panel = multilangSection.querySelector(`.lang-panel[data-lang="${lang}"]`);
                if (panel) {
                    panel.classList.add('active');
                }
            });
        });
    }

    setupModalListeners() {
        const editModal = document.getElementById('editModal');
        const closeEdit = document.getElementById('closeEdit');

        if (closeEdit) {
            closeEdit.addEventListener('click', () => {
                if (editModal) editModal.style.display = 'none';
                this.currentEditId = null;
            });
        }

        // Закрытие по клику вне модального окна
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) {
                    editModal.style.display = 'none';
                    this.currentEditId = null;
                }
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

    getR2WorkerUrl() {
        const r2Config = window.R2_CONFIG || {};
        return r2Config.WORKER_URL || '/api/r2-upload';
    }

    getR2PublicBase() {
        const r2Config = window.R2_CONFIG || {};
        return r2Config.IMAGES_PUBLIC_URL || r2Config.PUBLIC_URL || 'https://pub-a797bdf4261e4c448d835644b30caa41.r2.dev';
    }

    getMainNewsImagesR2Prefix() {
        return 'img/main-news';
    }

    buildR2PublicUrl(key) {
        const base = this.getR2PublicBase();
        if (!base) return '';
        const safeKey = (key || '').replace(/^\/+/, '');
        const cleanKey = safeKey.replace(/^abu-ic\//, '');
        const url = `${base}/${cleanKey}`;
        return url;
    }

    async uploadImageToStorage(file) {
        if (!file || file.size === 0) {
            return null;
        }
        
        try {
            const workerUrl = this.getR2WorkerUrl();
            if (!workerUrl) {
                throw new Error('R2 WORKER_URL не задан. Проверьте js/r2-config.js (WORKER_URL).');
            }

            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${safeExt}`;
            const key = `${this.getMainNewsImagesR2Prefix()}/${fileName}`;

            console.log('Отправляем изображение в R2:', { key, fileName, workerUrl });

            const response = await fetch(`${workerUrl}/upload?name=${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                },
                body: file
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Не удалось загрузить изображение в R2: ${response.status} ${errorText}`);
            }

            let payload = null;
            try {
                payload = await response.json();
            } catch (e) {
                payload = null;
            }

            let url = payload?.url;
            if (!url) {
                url = this.buildR2PublicUrl(key);
            }
            
            if (url && url.includes('%2F')) {
                url = decodeURIComponent(url);
            }
            
            console.log('Изображение загружено:', { key, url });
            
            return url || null;
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            throw new Error('Не удалось загрузить изображение: ' + error.message);
        }
    }

    async loadNews() {
        try {
            if (typeof window.supabase === 'undefined' || !window.supabase) {
                await this.waitForSupabase();
            }

            const { data, error } = await window.supabase
                .from('main_news')
                .select('*')
                .order('order_index', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Ошибка загрузки новостей:', error);
                throw error;
            }

            this.news = data || [];
            console.log('Загружено новостей главной страницы:', this.news.length);
        } catch (error) {
            console.error('Ошибка загрузки новостей:', error);
            this.showNotification('Ошибка загрузки новостей: ' + (error.message || error), 'error');
            this.news = [];
        }
    }

    renderNewsList() {
        const newsList = document.getElementById('mainNewsList');
        if (!newsList) {
            console.warn('Элемент mainNewsList не найден');
            return;
        }

        if (this.news.length === 0) {
            newsList.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 50px; color: #666;">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px; color: #ccc;"></i>
                    <p>Новостей пока нет. Добавьте первую новость!</p>
                </div>
            `;
            return;
        }

        const newsHTML = this.news.map(news => this.createNewsCard(news)).join('');
        newsList.innerHTML = newsHTML;

        // Привязываем обработчики кнопок
        this.attachCardEventListeners();
    }

    createNewsCard(news) {
        const lang = localStorage.getItem('selectedLanguage') || 'RU';
        const langLower = lang.toLowerCase();
        const title = news[`title_${langLower}`] || news.title_ru || 'Без заголовка';
        const description = news[`description_${langLower}`] || news.description_ru || '';
        
        let imageUrl = news.image_url || '';
        if (imageUrl && imageUrl.includes('%2F')) {
            imageUrl = decodeURIComponent(imageUrl);
        }
        if (imageUrl && imageUrl.includes('abu-ic/abu-ic/')) {
            imageUrl = imageUrl.replace(/abu-ic\/abu-ic\//, 'abu-ic/');
        }

        const statusClass = news.is_active ? 'active' : 'inactive';
        const statusText = news.is_active ? 'Активна' : 'Неактивна';

        return `
            <div class="news-card ${statusClass}" data-news-id="${news.id}">
                <div class="news-card-image">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22/%3E%3Ctext fill=%22%23999%22 x=%2250%22 y=%2250%22 text-anchor=%22middle%22%3EНет изображения%3C/text%3E%3C/svg%3E'">` : '<div class="no-image">Нет изображения</div>'}
                </div>
                <div class="news-card-content">
                    <h3>${title}</h3>
                    <p>${description}</p>
                    <div class="news-card-meta">
                        <span class="news-status ${statusClass}">${statusText}</span>
                        <span class="news-order">Порядок: ${news.order_index || 0}</span>
                        ${news.link_url ? `<a href="${news.link_url}" target="_blank" rel="noopener" class="news-link"><i class="fas fa-external-link-alt"></i> Ссылка</a>` : ''}
                    </div>
                </div>
                <div class="news-card-actions">
                    <button class="btn btn-sm btn-primary edit-news-btn" data-news-id="${news.id}">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="btn btn-sm btn-danger delete-news-btn" data-news-id="${news.id}">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            </div>
        `;
    }

    attachCardEventListeners() {
        // Кнопки редактирования
        document.querySelectorAll('.edit-news-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newsId = e.target.closest('.edit-news-btn').getAttribute('data-news-id');
                this.editNews(newsId);
            });
        });

        // Кнопки удаления
        document.querySelectorAll('.delete-news-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newsId = e.target.closest('.delete-news-btn').getAttribute('data-news-id');
                this.deleteNews(newsId);
            });
        });
    }

    async editNews(newsId) {
        const news = this.news.find(n => n.id === newsId);
        if (!news) {
            this.showNotification('Новость не найдена', 'error');
            return;
        }

        this.currentEditId = newsId;

        // Заполняем форму редактирования
        document.getElementById('editNewsId').value = news.id;
        document.getElementById('edit_title_ru').value = news.title_ru || '';
        document.getElementById('edit_title_en').value = news.title_en || '';
        document.getElementById('edit_title_kz').value = news.title_kz || '';
        document.getElementById('edit_description_ru').value = news.description_ru || '';
        document.getElementById('edit_description_en').value = news.description_en || '';
        document.getElementById('edit_description_kz').value = news.description_kz || '';
        document.getElementById('edit_link_url').value = news.link_url || '';
        document.getElementById('edit_image_url').value = news.image_url || '';
        document.getElementById('edit_order_index').value = news.order_index || 0;
        document.getElementById('edit_is_active').checked = news.is_active !== false;

        // Показываем текущее изображение
        const editCurrentImagePreview = document.getElementById('editCurrentImagePreview');
        const editNoImage = document.getElementById('editNoImage');
        if (news.image_url) {
            let imageUrl = news.image_url;
            if (imageUrl.includes('%2F')) {
                imageUrl = decodeURIComponent(imageUrl);
            }
            if (imageUrl.includes('abu-ic/abu-ic/')) {
                imageUrl = imageUrl.replace(/abu-ic\/abu-ic\//, 'abu-ic/');
            }
            editCurrentImagePreview.src = imageUrl;
            editCurrentImagePreview.style.display = 'block';
            editNoImage.style.display = 'none';
        } else {
            editCurrentImagePreview.style.display = 'none';
            editNoImage.style.display = 'block';
        }

        // Сбрасываем предпросмотр нового изображения
        const editImagePreview = document.getElementById('editImagePreview');
        if (editImagePreview) {
            editImagePreview.innerHTML = `
                <i class="fas fa-image"></i>
                <span>Выберите новое изображение (опционально)</span>
            `;
        }
        const editImage = document.getElementById('editImage');
        if (editImage) {
            editImage.value = '';
        }

        // Открываем модальное окно
        document.getElementById('editModal').style.display = 'flex';

        // Переинициализируем табы для модального окна
        this.initLanguageTabs(document.getElementById('editForm'));
        // Активируем русскую вкладку по умолчанию
        const ruTab = document.getElementById('editForm').querySelector('.lang-tab[data-lang="ru"]');
        if (ruTab) {
            ruTab.click();
        }
    }

    async handleSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            submitBtn.disabled = true;

            // Загружаем изображение если есть
            let imageUrl = formData.get('image_url') || '';
            const imageFile = formData.get('image');
            
            if (imageFile && imageFile.size > 0) {
                imageUrl = await this.uploadImageToStorage(imageFile);
            }

            const newsData = {
                title_ru: formData.get('title_ru'),
                title_en: formData.get('title_en') || null,
                title_kz: formData.get('title_kz') || null,
                description_ru: formData.get('description_ru'),
                description_en: formData.get('description_en') || null,
                description_kz: formData.get('description_kz') || null,
                link_url: formData.get('link_url') || null,
                image_url: imageUrl || null,
                order_index: parseInt(formData.get('order_index')) || 0,
                is_active: formData.get('is_active') === 'on'
            };

            console.log('Добавляем новость в Supabase:', newsData);

            const { data, error } = await window.supabase
                .from('main_news')
                .insert([newsData])
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('Новость успешно добавлена:', data);
            this.showNotification('Новость успешно добавлена!', 'success');
            
            // Очищаем форму
            form.reset();
            const imagePreview = document.getElementById('mainNewsImagePreview');
            if (imagePreview) {
                imagePreview.innerHTML = `
                    <i class="fas fa-image"></i>
                    <span>Выберите изображение (опционально)</span>
                `;
            }

            // Перезагружаем список
            await this.loadNews();
            this.renderNewsList();

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка добавления новости:', error);
            this.showNotification('Ошибка при добавлении новости: ' + error.message, 'error');
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить новость';
            submitBtn.disabled = false;
        }
    }

    async handleEditSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const newsId = formData.get('id');

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            submitBtn.disabled = true;

            // Загружаем новое изображение если есть
            let imageUrl = formData.get('image_url') || '';
            const imageFile = formData.get('image');
            const currentImageUrl = this.news.find(n => n.id === newsId)?.image_url;
            
            if (imageFile && imageFile.size > 0) {
                imageUrl = await this.uploadImageToStorage(imageFile);
            } else if (!imageUrl && currentImageUrl) {
                // Если не загружаем новое и не указан URL, оставляем старое
                imageUrl = currentImageUrl;
            }

            const newsData = {
                title_ru: formData.get('title_ru'),
                title_en: formData.get('title_en') || null,
                title_kz: formData.get('title_kz') || null,
                description_ru: formData.get('description_ru'),
                description_en: formData.get('description_en') || null,
                description_kz: formData.get('description_kz') || null,
                link_url: formData.get('link_url') || null,
                image_url: imageUrl || null,
                order_index: parseInt(formData.get('order_index')) || 0,
                is_active: formData.get('is_active') === 'on'
            };

            console.log('Обновляем новость в Supabase:', newsData);

            const { data, error } = await window.supabase
                .from('main_news')
                .update(newsData)
                .eq('id', newsId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('Новость успешно обновлена:', data);
            this.showNotification('Новость успешно обновлена!', 'success');
            
            // Закрываем модальное окно
            document.getElementById('editModal').style.display = 'none';
            this.currentEditId = null;

            // Перезагружаем список
            await this.loadNews();
            this.renderNewsList();

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка обновления новости:', error);
            this.showNotification('Ошибка при обновлении новости: ' + error.message, 'error');
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
            submitBtn.disabled = false;
        }
    }

    async deleteNews(newsId) {
        const news = this.news.find(n => n.id === newsId);
        if (!news) {
            this.showNotification('Новость не найдена', 'error');
            return;
        }

        const lang = localStorage.getItem('selectedLanguage') || 'RU';
        const langLower = lang.toLowerCase();
        const title = news[`title_${langLower}`] || news.title_ru || 'Без заголовка';

        if (!confirm(`Вы уверены, что хотите удалить новость "${title}"?`)) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('main_news')
                .delete()
                .eq('id', newsId);

            if (error) {
                throw error;
            }

            this.showNotification('Новость успешно удалена!', 'success');
            
            // Перезагружаем список
            await this.loadNews();
            this.renderNewsList();
        } catch (error) {
            console.error('Ошибка удаления новости:', error);
            this.showNotification('Ошибка при удалении новости: ' + error.message, 'error');
        }
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
    window.mainNewsAdmin = new MainNewsAdmin();
});

