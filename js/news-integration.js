// Интеграция новостей из админ-панели с основной страницей
class NewsIntegration {
    constructor() {
        this.news = [];
        this.currentPage = 1;
        this.itemsPerPage = 6; // Количество новостей на странице
        this.init();
    }

    async init() {
        // Загружаем новости из Supabase при загрузке страницы
        await this.loadNewsFromSupabase();
        this.loadNewsToPage(1);
        
        // Обновляем новости каждые 30 секунд
        setInterval(async () => {
            const currentPage = this.currentPage;
            await this.loadNewsFromSupabase();
            // Сохраняем текущую страницу при обновлении
            this.loadNewsToPage(currentPage);
        }, 30000);
    }

    async loadNewsFromSupabase() {
        try {
            // Проверяем, что Supabase инициализирован
            if (typeof supabase === 'undefined') {
                console.warn('Supabase не инициализирован, загружаем из localStorage как fallback');
                this.news = this.loadNewsFromStorage();
                return;
            }

            console.log('Запрос к Supabase: SELECT * FROM news...');
            const { data, error } = await supabase
                .from('news')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Ошибка Supabase при запросе:', error);
                console.error('Код ошибки:', error.code);
                console.error('Сообщение:', error.message);
                throw error;
            }

            console.log('Получено данных из Supabase:', data?.length || 0);
            
            // Если в Supabase есть новости, используем их
            if (data && data.length > 0) {
                console.log('✓ Используем новости из Supabase');
                // Преобразуем данные Supabase в формат для отображения
                this.news = data.map(item => {
                    let contentData = {};
                    try {
                        contentData = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
                    } catch (e) {
                        contentData = { main: item.content || '', description: '' };
                    }

                    // Получаем массив изображений
                    let images = [];
                    if (contentData.image_urls && Array.isArray(contentData.image_urls) && contentData.image_urls.length > 0) {
                        images = contentData.image_urls;
                    } else if (item.image_url) {
                        images = [item.image_url];
                    }
                    
                    return {
                        id: item.id,
                        title: item.title,
                        title_ru: contentData.title_ru || item.title,
                        title_en: contentData.title_en || item.title,
                        title_kz: contentData.title_kz || item.title,
                        description: contentData.description || '',
                        description_ru: contentData.description_ru || contentData.description || '',
                        description_en: contentData.description_en || contentData.description || '',
                        description_kz: contentData.description_kz || contentData.description || '',
                        content: contentData.main || '',
                        image: images.length > 0 ? images[0] : null,
                        imageUrl: images.length > 0 ? images[0] : null,
                        images: images, // Массив всех изображений
                        date: contentData.date || item.created_at,
                        createdAt: item.created_at,
                        updatedAt: item.updated_at,
                        // Сохраняем contentData для доступа к image_urls в news-detail.html
                        contentData: contentData
                    };
                });
                return; // Успешно загрузили из Supabase
            }

            // Если в Supabase нет новостей, пробуем загрузить из localStorage
            console.log('⚠ В Supabase нет новостей (пустая таблица), пробуем загрузить из localStorage');
            const localNews = this.loadNewsFromStorage();
            if (localNews && localNews.length > 0) {
                console.log(`✓ Загружено ${localNews.length} новостей из localStorage как fallback`);
                this.news = localNews;
            } else {
                console.log('В localStorage тоже нет новостей');
            }

        } catch (error) {
            console.error('✗ Ошибка загрузки новостей из Supabase:', error);
            
            // Проверяем тип ошибки
            if (error.message && error.message.includes('Failed to fetch')) {
                console.error('Проблема сети при подключении к Supabase');
                console.error('Проверьте:');
                console.error('1. Интернет соединение');
                console.error('2. Доступность Supabase: https://aeewpulwnamwavtejlzq.supabase.co');
                console.error('3. CORS настройки в Supabase');
            }
            
            // Fallback на localStorage если Supabase недоступен
            const localNews = this.loadNewsFromStorage();
            if (localNews && localNews.length > 0) {
                console.log(`✓ Используем ${localNews.length} новостей из localStorage как fallback`);
                this.news = localNews;
            } else {
                console.log('В localStorage тоже нет новостей');
                this.news = [];
            }
        }
    }

    loadNewsFromStorage() {
        try {
            const stored = localStorage.getItem('abu_news');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Ошибка загрузки новостей из localStorage:', error);
            return [];
        }
    }

    loadNewsToPage(page = 1) {
        const newsContainer = document.querySelector('.news-container');
        if (!newsContainer) return;

        // Если новостей нет, показываем заглушку
        if (this.news.length === 0) {
            newsContainer.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: #6c757d;">
                    <i class="fas fa-newspaper" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    <p>Новости загружаются...</p>
                </div>
            `;
            document.getElementById('paginationContainer').innerHTML = '';
            return;
        }

        // Сортируем новости по дате (новые сверху)
        const sortedNews = [...this.news].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Вычисляем пагинацию
        const totalPages = Math.ceil(sortedNews.length / this.itemsPerPage);
        this.currentPage = Math.max(1, Math.min(page, totalPages));
        
        // Получаем новости для текущей страницы
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedNews = sortedNews.slice(startIndex, endIndex);

        // Отображаем новости текущей страницы
        newsContainer.innerHTML = paginatedNews.map(news => {
            const title = news.title_ru || news.title;
            const titleEn = news.title_en || news.title;
            const titleKz = news.title_kz || news.title;
            
            return `
            <div class="news-card">
                <a href="${this.getNewsDetailUrl(news)}" class="news-link">
                    <div class="single-image">
                        <img src="${this.getNewsImage(news)}" alt="${title}">
                        <!-- Логотипы на изображении -->
                        <div class="news-card-logos">
                            <img src="img/Logo-ABU.png" alt="ABU Logo" class="news-logo-abu">
                            <img src="img/LogoCirculEC.png" alt="CirculEC Logo" class="news-logo-circulen" onerror="this.src='img/logocirculec2.png'">
                        </div>
                        <!-- Оранжевый баннер с заголовком -->
                        <div class="news-card-banner" data-ru="${title}" data-en="${titleEn}" data-kz="${titleKz}">
                            ${title}
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="news-title" data-ru="${title}" data-en="${titleEn}" data-kz="${titleKz}">
                            ${title}
                        </div>
                        <span class="news-date" data-ru="${this.formatDate(news.date)}" data-en="${this.formatDateEn(news.date)}" data-kz="${this.formatDateKz(news.date)}">
                            ${this.formatDate(news.date)}
                        </span>
                        <div class="news-text">
                            <p data-ru="${news.description_ru || news.description}" data-en="${news.description_en || news.description}" data-kz="${news.description_kz || news.description}">
                                ${news.description_ru || news.description}
                            </p>
                            <span class="read-more" data-ru="Читать подробнее →" data-en="Read more →" data-kz="Толығырақ оқу →">
                                Читать подробнее →
                            </span>
                        </div>
                    </div>
                </a>
            </div>
        `;
        }).join('');
        
        // Отображаем пагинацию
        this.renderPagination(totalPages);
    }
    
    renderPagination(totalPages) {
        const paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer) return;
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        const currentPage = this.currentPage;
        let paginationHTML = '<div class="pagination">';
        
        // Кнопка "Предыдущая"
        paginationHTML += `
            <button class="pagination-btn prev" onclick="newsIntegration.goToPage(${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Предыдущая
            </button>
        `;
        
        // Номера страниц
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // Первая страница
        if (startPage > 1) {
            paginationHTML += `
                <button class="pagination-btn" onclick="newsIntegration.goToPage(1)">1</button>
            `;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        
        // Страницы в диапазоне
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="newsIntegration.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Последняя страница
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHTML += `
                <button class="pagination-btn" onclick="newsIntegration.goToPage(${totalPages})">
                    ${totalPages}
                </button>
            `;
        }
        
        // Кнопка "Следующая"
        paginationHTML += `
            <button class="pagination-btn next" onclick="newsIntegration.goToPage(${currentPage + 1})" 
                    ${currentPage === totalPages ? 'disabled' : ''}>
                Следующая <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        paginationHTML += '</div>';
        
        // Информация о странице
        const startItem = (currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(currentPage * this.itemsPerPage, this.news.length);
        paginationHTML += `
            <div class="pagination-info">
                Показано ${startItem}-${endItem} из ${this.news.length} новостей
            </div>
        `;
        
        paginationContainer.innerHTML = paginationHTML;
    }
    
    goToPage(page) {
        const totalPages = Math.ceil(this.news.length / this.itemsPerPage);
        if (page < 1 || page > totalPages) {
            return;
        }
        this.loadNewsToPage(page);
        // Прокручиваем к началу новостей
        const newsSection = document.querySelector('.news-container');
        if (newsSection) {
            newsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    getNewsImage(news) {
        if (news.image) {
            return news.image;
        } else if (news.imageUrl) {
            return news.imageUrl;
        } else {
            return 'img/news_first_card.jpg'; // Заглушка
        }
    }

    getNewsDetailUrl(news) {
        // Используем универсальную страницу для всех новостей
        return `news-detail.html?id=${news.id}`;
    }

    createSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatDateEn(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatDateKz(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('kk-KZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Метод для получения новости по ID (для детальных страниц)
    getNewsById(id) {
        return this.news.find(news => news.id === id);
    }

    // Метод для создания детальной страницы новости
    createNewsDetailPage(news) {
        return `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${news.title} - ABU</title>
                <link rel="stylesheet" href="css/erasmus+circulen.css">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
                <link rel="icon" type="img/abuicon" href="img/favicon.ico">
            </head>
            <body>
                <div class="wrapper">
                    <div class="content">
                        <!-- Навигация -->
                        <div class="menu">
                            <div class="container">
                                <div class="menu__row">
                                    <div class="logo__title">
                                        <a href="index.html">
                                            <img class="menu__logo" src="img/Logo-ABU.png" alt="ABU-logo">
                                        </a>
                                    </div>
                                    <div class="header-actions" style="margin-left: auto;">
                                        <a href="erasmus+circulen.html" style="background: rgba(255,255,255,0.2); color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px; transition: all 0.3s ease; border: 1px solid rgba(255,255,255,0.3); margin-right: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                                            <i class="fas fa-arrow-left"></i>
                                            Назад к новостям
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Контент новости -->
                        <div class="news-detail-container" style="max-width: 800px; margin: 2rem auto; padding: 0 2rem;">
                            <article class="news-detail">
                                <header class="news-detail-header">
                                    <h1 class="news-detail-title">${news.title}</h1>
                                    <div class="news-detail-meta">
                                        <span class="news-detail-date">${this.formatDate(news.date)}</span>
                                    </div>
                                </header>
                                
                                <div class="news-detail-image">
                                    <img src="${this.getNewsImage(news)}" alt="${news.title}" style="width: 100%; height: 400px; object-fit: cover; border-radius: 12px; margin: 2rem 0;">
                                </div>
                                
                                <div class="news-detail-content">
                                    <div class="news-detail-description" style="font-size: 1.2rem; color: #6c757d; margin-bottom: 2rem; line-height: 1.6;">
                                        ${news.description}
                                    </div>
                                    
                                    <div class="news-detail-text" style="font-size: 1.1rem; line-height: 1.8; color: #333;">
                                        ${news.content.replace(/\n/g, '<br>')}
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
                
                <script src="js/language-switcher.js"></script>
            </body>
            </html>
        `;
    }
}

// Инициализация при загрузке страницы
let newsIntegration;
document.addEventListener('DOMContentLoaded', () => {
    newsIntegration = new NewsIntegration();
});

// Экспортируем для использования в других скриптах
window.newsIntegration = newsIntegration;
