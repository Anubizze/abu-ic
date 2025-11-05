// Админ-панель новостей - JavaScript функционал

class NewsAdmin {
    constructor() {
        this.news = [];
        this.currentEditId = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupImageUpload();
        this.setupLanguageTabs();
        this.setCurrentDate();
        
        // Ждём инициализации Supabase перед загрузкой новостей
        if (typeof supabase === 'undefined' || !supabase) {
            console.log('Ожидание инициализации Supabase...');
            await this.waitForSupabase(3000);
        }
        
        // Загружаем новости
        await this.loadNewsFromSupabase();
        this.renderNewsList();
    }

    setupEventListeners() {
        // Форма добавления новости
        const newsForm = document.getElementById('newsForm');
        if (!newsForm) {
            console.error('Форма newsForm не найдена!');
            return;
        }
        console.log('Привязываем обработчик формы...');
        newsForm.addEventListener('submit', (e) => {
            console.log('Событие submit формы вызвано!');
            this.handleSubmit(e);
        });

        // Форма редактирования новости
        const editForm = document.getElementById('editForm');
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditSubmit(e);
        });

        // Кнопка отмены редактирования
        const cancelEditBtn = document.getElementById('cancelEdit');
        cancelEditBtn.addEventListener('click', () => {
            document.getElementById('editModal').style.display = 'none';
            this.currentEditId = null;
        });




        // Кнопка обновления списка
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', async () => {
            const originalText = refreshBtn.innerHTML;
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
            
            try {
                await this.loadNewsFromSupabase();
                this.renderNewsList();
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            } catch (error) {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }
        });

        // Модальные окна
        this.setupModalListeners();

        // URL изображения
        const imageUrlInput = document.getElementById('newsImageUrl');
        imageUrlInput.addEventListener('input', (e) => this.handleImageUrlChange(e));

        // Изображение для редактирования
        const editImageInput = document.getElementById('editImage');
        const editImagePreview = document.getElementById('editImagePreview');
        editImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.previewImage(file, editImagePreview);
            }
        });
    }

    setupImageUpload() {
        const imageInput = document.getElementById('newsImage');
        const imagePreview = document.getElementById('imagePreview');

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.previewImage(file, imagePreview);
            }
        });

        // Drag and drop для изображений
        imagePreview.addEventListener('dragover', (e) => {
            e.preventDefault();
            imagePreview.style.borderColor = '#2a5298';
            imagePreview.style.background = '#f0f4ff';
        });

        imagePreview.addEventListener('dragleave', (e) => {
            e.preventDefault();
            imagePreview.style.borderColor = '#dee2e6';
            imagePreview.style.background = '#f8f9fa';
        });

        imagePreview.addEventListener('drop', (e) => {
            e.preventDefault();
            imagePreview.style.borderColor = '#dee2e6';
            imagePreview.style.background = '#f8f9fa';

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    imageInput.files = files;
                    this.previewImage(file, imagePreview);
                }
            }
        });
    }

    previewImage(file, previewElement) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewElement.innerHTML = `
                <img src="${e.target.result}" alt="Предварительный просмотр">
                <span>${file.name}</span>
            `;
            previewElement.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }

    handleImageUrlChange(e) {
        const url = e.target.value;
        const imagePreview = document.getElementById('imagePreview');
        
        if (url) {
            // Проверяем, что это валидный URL изображения
            const img = new Image();
            img.onload = () => {
                imagePreview.innerHTML = `
                    <img src="${url}" alt="Предварительный просмотр">
                    <span>Изображение по URL</span>
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
                <span>Выберите изображение</span>
            `;
            imagePreview.classList.remove('has-image');
        }
    }

    setupLanguageTabs(selector = '') {
        const baseSelector = selector || '';
        const tabs = document.querySelectorAll(`${baseSelector} .lang-tab`);
        const panels = document.querySelectorAll(`${baseSelector} .lang-panel`);

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const lang = tab.dataset.lang;
                const container = tab.closest('.multilang-section');
                
                if (!container) return;
                
                // Убираем активный класс со всех табов и панелей в этом контейнере
                container.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
                container.querySelectorAll('.lang-panel').forEach(p => p.classList.remove('active'));
                
                // Добавляем активный класс к выбранному табу и панели
                tab.classList.add('active');
                container.querySelector(`.lang-panel[data-lang="${lang}"]`)?.classList.add('active');
            });
        });
    }

    setupModalListeners() {
        // Предварительный просмотр
        const previewModal = document.getElementById('previewModal');
        const closePreview = document.getElementById('closePreview');
        
        closePreview.addEventListener('click', () => {
            previewModal.style.display = 'none';
        });

        // Редактирование
        const editModal = document.getElementById('editModal');
        const closeEdit = document.getElementById('closeEdit');
        
        closeEdit.addEventListener('click', () => {
            editModal.style.display = 'none';
        });

        // Закрытие по клику вне модального окна
        window.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.style.display = 'none';
            }
            if (e.target === editModal) {
                editModal.style.display = 'none';
            }
        });
    }

    setCurrentDate() {
        const dateInput = document.getElementById('newsDate');
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        console.log('=== Начало сохранения новости ===');
        const formData = new FormData(e.target);
        
        if (!this.validateFormData(formData)) {
            console.log('Валидация не пройдена');
            return;
        }
        
        console.log('Валидация пройдена, начинаем сохранение...');
        
        try {
            // Показываем загрузку
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            submitBtn.disabled = true;
            
            console.log('Вызываем addNews...');
            const result = await this.addNews(formData);
            console.log('Результат добавления:', result);
            
            console.log('Очищаем форму и перезагружаем новости...');
            this.resetForm();
            await this.loadNewsFromSupabase();
            this.renderNewsList();
            
            console.log('✓ Новость успешно сохранена!');
            this.showNotification('Новость успешно сохранена!', 'success');
            
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('✗ Ошибка сохранения новости:', error);
            console.error('Детали ошибки:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            this.showNotification('Ошибка при сохранении новости: ' + (error.message || error), 'error');
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить новость';
            submitBtn.disabled = false;
        }
    }

    async handleEditSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        if (!this.validateFormData(formData)) {
            return;
        }
        
        try {
            // Показываем загрузку
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            submitBtn.disabled = true;
            
            await this.updateNews(this.currentEditId, formData);
            
            document.getElementById('editModal').style.display = 'none';
            this.currentEditId = null;
            await this.loadNewsFromSupabase();
            this.renderNewsList();
            this.showNotification('Новость успешно обновлена!', 'success');
            
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка обновления новости:', error);
            this.showNotification('Ошибка при обновлении новости: ' + error.message, 'error');
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
            submitBtn.disabled = false;
        }
    }

    async uploadImageToStorage(file) {
        if (!file || file.size === 0) {
            return null;
        }
        
        try {
            // Генерируем уникальное имя файла
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `news/${fileName}`;
            
            // Загружаем файл в Supabase Storage
            const { data, error } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (error) {
                throw error;
            }
            
            // Получаем публичный URL
            const { data: urlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);
            
            return urlData.publicUrl;
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            throw new Error('Не удалось загрузить изображение: ' + error.message);
        }
    }

    async addNews(formData) {
        // Проверяем инициализацию Supabase
        if (typeof supabase === 'undefined' || !supabase) {
            await this.waitForSupabase(3000);
            if (typeof supabase === 'undefined' || !supabase) {
                throw new Error('Supabase не инициализирован');
            }
        }

        const imageFile = formData.get('image');
        const imageUrl = formData.get('imageUrl');
        
        // Загружаем изображение если есть файл
        let finalImageUrl = imageUrl || null;
        if (imageFile && imageFile.size > 0) {
            finalImageUrl = await this.uploadImageToStorage(imageFile);
        }
        
        if (!finalImageUrl) {
            throw new Error('Необходимо добавить изображение или URL изображения');
        }
        
        // Получаем многоязычные данные
        const title_ru = formData.get('title_ru');
        const title_en = formData.get('title_en');
        const title_kz = formData.get('title_kz');
        const description_ru = formData.get('description_ru');
        const description_en = formData.get('description_en');
        const description_kz = formData.get('description_kz');
        const content_ru = formData.get('content_ru');
        const content_en = formData.get('content_en');
        const content_kz = formData.get('content_kz');
        
        // Используем русский заголовок как основной (fallback)
        const mainTitle = title_ru || title_en || title_kz || 'Новость';
        
        // Формируем данные для Supabase
        const newsData = {
            title: mainTitle,
            image_url: finalImageUrl,
            author: 'Admin'
        };
        
        // Сохраняем многоязычные данные в JSON формате в поле content
        const multilangData = {
            title_ru: title_ru || '',
            title_en: title_en || '',
            title_kz: title_kz || '',
            description_ru: description_ru || '',
            description_en: description_en || '',
            description_kz: description_kz || '',
            content_ru: content_ru || '',
            content_en: content_en || '',
            content_kz: content_kz || '',
            date: formData.get('date')
        };
        
        // Сохраняем многоязычные данные в поле content как JSON
        // Используем content_ru как основной контент для обратной совместимости
        newsData.content = JSON.stringify({
            main: content_ru || '', // Для обратной совместимости
            description: description_ru || '', // Для обратной совместимости
            ...multilangData
        });
        
        console.log('Добавление новости в Supabase:', {
            title: newsData.title,
            has_image: !!newsData.image_url,
            content_length: newsData.content?.length
        });
        
        // Проверяем, что supabase доступен
        if (!supabase) {
            throw new Error('Supabase клиент не инициализирован');
        }
        
        console.log('Выполняем INSERT запрос...');
        // Вставляем новость в Supabase
        const { data, error } = await supabase
            .from('news')
            .insert([newsData])
            .select()
            .single();
        
        if (error) {
            console.error('✗ Ошибка Supabase при добавлении:', error);
            console.error('Код ошибки:', error.code);
            console.error('Сообщение:', error.message);
            console.error('Детали:', error.details);
            console.error('Подсказка:', error.hint);
            throw error;
        }
        
        console.log('✓ Новость успешно добавлена в Supabase:', data);
        console.log('ID новой новости:', data.id);
        return data;
    }

    async updateNews(id, formData) {
        const imageFile = formData.get('image');
        const imageUrl = formData.get('imageUrl');
        
        // Загружаем изображение если есть новый файл
        let finalImageUrl = imageUrl || null;
        if (imageFile && imageFile.size > 0) {
            finalImageUrl = await this.uploadImageToStorage(imageFile);
        }
        
        // Если нет нового изображения и нет URL, оставляем старое
        const existingNews = this.news.find(n => n.id === id);
        if (!finalImageUrl && existingNews) {
            finalImageUrl = existingNews.image_url;
        }
        
        if (!finalImageUrl) {
            throw new Error('Необходимо добавить изображение или URL изображения');
        }
        
        // Получаем многоязычные данные
        const title_ru = formData.get('title_ru');
        const title_en = formData.get('title_en');
        const title_kz = formData.get('title_kz');
        const description_ru = formData.get('description_ru');
        const description_en = formData.get('description_en');
        const description_kz = formData.get('description_kz');
        const content_ru = formData.get('content_ru');
        const content_en = formData.get('content_en');
        const content_kz = formData.get('content_kz');
        
        // Используем русский заголовок как основной (fallback)
        const mainTitle = title_ru || title_en || title_kz || existingNews?.title || 'Новость';
        
        // Формируем данные для обновления
        const newsData = {
            title: mainTitle,
            image_url: finalImageUrl,
        };
        
        // Сохраняем многоязычные данные
        const multilangData = {
            title_ru: title_ru || '',
            title_en: title_en || '',
            title_kz: title_kz || '',
            description_ru: description_ru || '',
            description_en: description_en || '',
            description_kz: description_kz || '',
            content_ru: content_ru || '',
            content_en: content_en || '',
            content_kz: content_kz || '',
            date: formData.get('date')
        };
        
        // Сохраняем многоязычные данные в поле content как JSON
        // Используем content_ru как основной контент для обратной совместимости
        newsData.content = JSON.stringify({
            main: content_ru || '', // Для обратной совместимости
            description: description_ru || '', // Для обратной совместимости
            ...multilangData
        });
        
        // Обновляем новость в Supabase
        const { data, error } = await supabase
            .from('news')
            .update(newsData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        return data;
    }

    async deleteNews(id) {
        if (!confirm('Вы уверены, что хотите удалить эту новость?')) {
            return;
        }
        
        try {
            // Удаляем новость из Supabase
            const { error } = await supabase
                .from('news')
                .delete()
                .eq('id', id);
            
            if (error) {
                throw error;
            }
            
            // Удаляем из локального массива
            this.news = this.news.filter(n => n.id !== id);
            this.renderNewsList();
            this.showNotification('Новость удалена!', 'success');
        } catch (error) {
            console.error('Ошибка удаления новости:', error);
            this.showNotification('Ошибка при удалении новости: ' + error.message, 'error');
        }
    }

    createEditFormHTML() {
        const editForm = document.getElementById('editForm');
        if (!editForm || editForm.innerHTML.trim() !== '') {
            return; // Форма уже создана
        }
        
        editForm.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label for="editDate">Дата публикации *</label>
                    <input type="date" id="editDate" name="date" required>
                </div>
            </div>

            <!-- Загрузка изображения -->
            <div class="form-group">
                <label for="editImage">Изображение новости</label>
                <div class="image-upload-container">
                    <input type="file" id="editImage" name="image" accept="image/*">
                    <div class="image-preview" id="editImagePreview">
                        <i class="fas fa-image"></i>
                        <span>Выберите изображение</span>
                    </div>
                </div>
            </div>

            <!-- URL изображения (альтернатива загрузке) -->
            <div class="form-group">
                <label for="editImageUrl">Или введите URL изображения</label>
                <input type="url" id="editImageUrl" name="imageUrl" placeholder="https://example.com/image.jpg">
            </div>

            <!-- Многоязычность -->
            <div class="multilang-section">
                <h3><i class="fas fa-globe"></i> Многоязычные версии</h3>
                
                <div class="lang-tabs">
                    <button type="button" class="lang-tab active" data-lang="ru">Русский</button>
                    <button type="button" class="lang-tab" data-lang="en">English</button>
                    <button type="button" class="lang-tab" data-lang="kz">Қазақша</button>
                </div>

                <div class="lang-content">
                    <div class="lang-panel active" data-lang="ru">
                        <div class="form-group">
                            <label>Заголовок (RU) *</label>
                            <input type="text" name="title_ru" required placeholder="Заголовок на русском">
                        </div>
                        <div class="form-group">
                            <label>Краткое описание (RU) *</label>
                            <textarea name="description_ru" required placeholder="Краткое описание на русском" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Полный текст новости (RU) *</label>
                            <textarea name="content_ru" required placeholder="Полный текст новости на русском" rows="8"></textarea>
                        </div>
                    </div>

                    <div class="lang-panel" data-lang="en">
                        <div class="form-group">
                            <label>Title (EN) *</label>
                            <input type="text" name="title_en" required placeholder="Title in English">
                        </div>
                        <div class="form-group">
                            <label>Description (EN) *</label>
                            <textarea name="description_en" required placeholder="Description in English" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Full text (EN) *</label>
                            <textarea name="content_en" required placeholder="Full text in English" rows="8"></textarea>
                        </div>
                    </div>

                    <div class="lang-panel" data-lang="kz">
                        <div class="form-group">
                            <label>Тақырып (KZ) *</label>
                            <input type="text" name="title_kz" required placeholder="Тақырып қазақша">
                        </div>
                        <div class="form-group">
                            <label>Сипаттама (KZ) *</label>
                            <textarea name="description_kz" required placeholder="Сипаттама қазақша" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Толық мәтін (KZ) *</label>
                            <textarea name="content_kz" required placeholder="Толық мәтін қазақша" rows="8"></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i>
                    Сохранить изменения
                </button>
                <button type="button" class="btn btn-secondary" id="cancelEdit">
                    <i class="fas fa-times"></i>
                    Отмена
                </button>
            </div>
        `;
        
        // Инициализируем табы языков для формы редактирования
        this.setupLanguageTabs('#editForm');
    }

    editNews(id) {
        const news = this.news.find(n => n.id === id);
        if (news) {
            this.currentEditId = id;
            this.createEditFormHTML(); // Создаем форму если её еще нет
            this.populateEditForm(news);
            document.getElementById('editModal').style.display = 'block';
        }
    }

    populateEditForm(news) {
        const editForm = document.getElementById('editForm');
        
        // Парсим JSON из content если это объект
        let contentData = {};
        try {
            contentData = typeof news.content === 'string' ? JSON.parse(news.content) : news.content;
        } catch (e) {
            contentData = { main: news.content || '', description: '' };
        }
        
        // Заполняем основную форму
        editForm.querySelector('[name="date"]').value = contentData.date || '';
        editForm.querySelector('[name="imageUrl"]').value = news.image_url || '';
        
        // Заполняем многоязычные поля
        editForm.querySelector('[name="title_ru"]').value = contentData.title_ru || contentData.title || news.title || '';
        editForm.querySelector('[name="title_en"]').value = contentData.title_en || '';
        editForm.querySelector('[name="title_kz"]').value = contentData.title_kz || '';
        editForm.querySelector('[name="description_ru"]').value = contentData.description_ru || contentData.description || '';
        editForm.querySelector('[name="description_en"]').value = contentData.description_en || '';
        editForm.querySelector('[name="description_kz"]').value = contentData.description_kz || '';
        editForm.querySelector('[name="content_ru"]').value = contentData.content_ru || contentData.main || '';
        editForm.querySelector('[name="content_en"]').value = contentData.content_en || '';
        editForm.querySelector('[name="content_kz"]').value = contentData.content_kz || '';
        
        // Показываем изображение если есть
        if (news.image_url) {
            const imagePreview = editForm.querySelector('.image-preview');
            if (imagePreview) {
                imagePreview.innerHTML = `
                    <img src="${news.image_url}" alt="Текущее изображение">
                    <span>Текущее изображение</span>
                `;
                imagePreview.classList.add('has-image');
            }
        }
    }

    showPreview() {
        const formData = new FormData(document.getElementById('newsForm'));
        
        if (this.validateFormData(formData)) {
            const imageFile = formData.get('image');
            const imageUrl = formData.get('imageUrl');
            
            let imageSrc = imageUrl || '';
            if (imageFile && imageFile.size > 0) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.renderPreview({
                        title: formData.get('title'),
                        description: formData.get('description'),
                        content: formData.get('content'),
                        date: formData.get('date'),
                        imageSrc: e.target.result
                    });
                };
                reader.readAsDataURL(imageFile);
                return;
            }
            
            imageSrc = imageSrc || 'img/news_first_card.jpg';
            this.renderPreview({
                title: formData.get('title'),
                description: formData.get('description'),
                content: formData.get('content'),
                date: formData.get('date'),
                imageSrc: imageSrc
            });
        }
    }

    async showPreviewById(id) {
        const news = this.news.find(n => n.id === id);
        if (news) {
            let contentData = {};
            try {
                contentData = typeof news.content === 'string' ? JSON.parse(news.content) : news.content;
            } catch (e) {
                contentData = { description: '', date: news.created_at };
            }
            
            this.renderPreview({
                title: news.title,
                description: contentData.description || '',
                content: contentData.main || '',
                date: contentData.date || news.created_at,
                imageSrc: news.image_url || 'img/news_first_card.jpg'
            });
            document.getElementById('previewModal').style.display = 'block';
        }
    }

    renderPreview(newsData) {
        const previewContent = document.getElementById('previewContent');
        
        // Рендерим как карточку новости (как на сайте) + полная страница
        previewContent.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto;">
                <h3 style="margin-bottom: 20px; color: #333;">Карточка новости (как на сайте):</h3>
                <div class="news-card" style="margin-bottom: 30px;">
                    <div class="single-image">
                        <img src="${newsData.imageSrc}" alt="${newsData.title}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 8px 8px 0 0;">
                    </div>
                    <div class="news-content" style="padding: 20px;">
                        <div class="news-title" style="font-size: 1.5rem; font-weight: 700; color: #2c3e50; margin-bottom: 10px;">
                            ${newsData.title}
                        </div>
                        <span class="news-date" style="color: #7f8c8d; font-size: 0.9rem; display: block; margin-bottom: 15px;">
                            ${this.formatDate(newsData.date)}
                        </span>
                        <div class="news-text">
                            <p style="color: #555; line-height: 1.6; margin-bottom: 10px;">
                                ${newsData.description || 'Описание новости'}
                            </p>
                            <span class="read-more" style="color: #3498db; font-weight: 600; cursor: pointer;">
                                Читать подробнее →
                            </span>
                        </div>
                    </div>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 2px solid #f0f0f0;">
                
                <h3 style="margin-bottom: 20px; color: #333;">Полная страница новости:</h3>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; border: 1px solid #e0e0e0;">
                    <article class="news-detail">
                        <header style="margin-bottom: 25px;">
                            <h1 style="font-size: 2.5rem; font-weight: 700; color: #2c3e50; margin-bottom: 15px; line-height: 1.3;">
                                ${newsData.title}
                            </h1>
                            <div style="display: flex; align-items: center; gap: 15px; color: #7f8c8d; margin-bottom: 20px;">
                                <span><i class="fas fa-calendar"></i> ${this.formatDate(newsData.date)}</span>
                                <span><i class="fas fa-user"></i> Admin</span>
                            </div>
                        </header>
                        
                        <div style="width: 100%; margin-bottom: 25px;">
                            <img src="${newsData.imageSrc}" alt="${newsData.title}" style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        </div>
                        
                        <div style="font-size: 1.1rem; line-height: 1.8; color: #2c3e50;">
                            ${newsData.description ? `
                            <div style="font-size: 1.3rem; color: #34495e; font-weight: 500; line-height: 1.6; margin-bottom: 20px;">
                                ${newsData.description}
                            </div>
                            ` : ''}
                            <div style="white-space: pre-wrap;">
                                ${newsData.content || 'Полный текст новости будет здесь...'}
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        `;
        
        document.getElementById('previewModal').style.display = 'block';
    }

    renderNewsList() {
        const newsList = document.getElementById('newsList');
        
        if (this.news.length === 0) {
            newsList.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-newspaper" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    <p>Новостей пока нет. Добавьте первую новость!</p>
                </div>
            `;
            return;
        }

        newsList.innerHTML = this.news.map(news => {
            // Парсим content для получения description и date
            let contentData = {};
            try {
                contentData = typeof news.content === 'string' ? JSON.parse(news.content) : news.content;
            } catch (e) {
                contentData = { description: '', date: news.created_at };
            }
            
            const date = contentData.date || news.created_at;
            const description = contentData.description || '';
            
            return `
            <div class="news-item">
                <div class="news-item-header">
                    <div class="news-item-info">
                        <h4 class="news-item-title">${news.title}</h4>
                        <div class="news-item-date">${this.formatDate(date)}</div>
                        <p class="news-item-description">${description}</p>
                    </div>
                    ${news.image_url ? `
                        <img src="${news.image_url}" alt="${news.title}" class="news-item-image">
                    ` : ''}
                </div>
                <div class="news-item-actions">
                    <button class="btn btn-secondary" onclick="newsAdmin.editNews('${news.id}')">
                        <i class="fas fa-edit"></i>
                        Редактировать
                    </button>
                    <button class="btn btn-outline" onclick="newsAdmin.showPreviewById('${news.id}')">
                        <i class="fas fa-eye"></i>
                        Просмотр
                    </button>
                    <button class="btn btn-danger" onclick="newsAdmin.deleteNews('${news.id}')">
                        <i class="fas fa-trash"></i>
                        Удалить
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    validateFormData(formData) {
        console.log('=== Валидация формы ===');
        const date = formData.get('date');
        const title_ru = formData.get('title_ru');
        const description_ru = formData.get('description_ru');
        const content_ru = formData.get('content_ru');
        const imageFile = formData.get('image');
        const imageUrl = formData.get('imageUrl');
        
        console.log('Данные формы:', {
            title_ru: title_ru?.substring(0, 50),
            date,
            hasDescription_ru: !!description_ru,
            hasContent_ru: !!content_ru,
            hasImageFile: imageFile && imageFile.size > 0,
            hasImageUrl: !!imageUrl
        });
        
        if (!title_ru || !title_ru.trim()) {
            console.log('✗ Ошибка: Заголовок (RU) пустой');
            this.showNotification('Заголовок новости на русском языке обязателен!', 'error');
            return false;
        }
        if (!date) {
            console.log('✗ Ошибка: Дата не указана');
            this.showNotification('Дата публикации обязательна!', 'error');
            return false;
        }
        if (!description_ru || !description_ru.trim()) {
            console.log('✗ Ошибка: Описание (RU) пустое');
            this.showNotification('Описание новости на русском языке обязательно!', 'error');
            return false;
        }
        if (!content_ru || !content_ru.trim()) {
            console.log('✗ Ошибка: Содержание (RU) пустое');
            this.showNotification('Содержание новости на русском языке обязательно!', 'error');
            return false;
        }
        if ((!imageFile || imageFile.size === 0) && !imageUrl) {
            // Если редактируем, проверяем что уже есть изображение
            if (!this.currentEditId) {
                console.log('✗ Ошибка: Изображение не указано');
                this.showNotification('Необходимо добавить изображение или URL изображения!', 'error');
                return false;
            }
        }
        console.log('✓ Валидация пройдена');
        return true;
    }

    resetForm() {
        document.getElementById('newsForm').reset();
        this.currentEditId = null;
        this.setCurrentDate();
        
        // Сбрасываем превью изображения
        const imagePreview = document.getElementById('imagePreview');
        imagePreview.innerHTML = `
            <i class="fas fa-image"></i>
            <span>Выберите изображение</span>
        `;
        imagePreview.classList.remove('has-image');
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    generateId() {
        return 'news_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Работа с Supabase
    async loadNewsFromSupabase() {
        try {
            // Проверяем, что supabase инициализирован
            if (typeof supabase === 'undefined' || !supabase) {
                console.error('Supabase не инициализирован');
                // Пробуем подождать и инициализировать
                await this.waitForSupabase();
                if (typeof supabase === 'undefined' || !supabase) {
                    throw new Error('Supabase клиент недоступен. Проверьте подключение скриптов.');
                }
            }

            console.log('Загрузка новостей из Supabase...');
            const { data, error } = await supabase
                .from('news')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Ошибка Supabase:', error);
                throw error;
            }
            
            console.log('Загружено новостей:', data?.length || 0);
            this.news = data || [];
            
            // Если новостей нет, это нормально - просто пустой список
            if (this.news.length === 0) {
                console.log('Новостей в базе данных нет');
            }
        } catch (error) {
            console.error('Ошибка загрузки новостей из Supabase:', error);
            this.showNotification('Ошибка загрузки новостей: ' + (error.message || error), 'error');
            this.news = [];
        }
    }

    async waitForSupabase(maxWait = 5000) {
        const startTime = Date.now();
        while (typeof supabase === 'undefined' || !supabase) {
            if (Date.now() - startTime > maxWait) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Экспорт новостей для интеграции с основной страницей
    exportNews() {
        return this.news;
    }
}

// Добавляем CSS для анимаций уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Инициализация при загрузке страницы
let newsAdmin;

// Проверяем, нужно ли инициализировать админку
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем различные условия для инициализации админки
    const hash = window.location.hash;
    const isAdminPath = hash === '#admin' || hash === '#/admin';
    const isAdminPage = window.location.pathname.includes('admin.html');
    const adminPanel = document.getElementById('adminPanel');
    const newsForm = document.getElementById('newsForm'); // Если есть форма новостей, значит это админка
    
    // Инициализируем если:
    // 1. URL содержит #admin
    // 2. Это страница admin.html
    // 3. Есть элемент adminPanel который виден
    // 4. Есть форма newsForm (прямой признак админки)
    const shouldInit = isAdminPath || isAdminPage || 
                      (adminPanel && adminPanel.style.display !== 'none') ||
                      (newsForm !== null);
    
    console.log('Проверка инициализации админки:', {
        isAdminPath,
        isAdminPage,
        hasAdminPanel: !!adminPanel,
        hasNewsForm: !!newsForm,
        shouldInit
    });
    
    if (shouldInit) {
        console.log('Инициализируем NewsAdmin...');
        newsAdmin = new NewsAdmin();
        window.newsAdmin = newsAdmin;
        console.log('✓ NewsAdmin инициализирован');
    } else {
        console.log('Админка не инициализирована - условия не выполнены');
    }
});

// Экспортируем функцию для ручной инициализации
window.initNewsAdmin = function() {
    if (!newsAdmin && typeof NewsAdmin !== 'undefined') {
        newsAdmin = new NewsAdmin();
        window.newsAdmin = newsAdmin;
        return newsAdmin;
    }
    return newsAdmin;
};
