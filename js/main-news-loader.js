// Загрузчик новостей для главной страницы и страницы международного сотрудничества
class MainNewsLoader {
    constructor() {
        this.news = [];
        this.currentLanguage = localStorage.getItem('selectedLanguage') || 'RU';
    }

    async init() {
        // Ждем инициализации Supabase
        await this.waitForSupabase();
        
        // Загружаем новости
        await this.loadNews();
        
        // Рендерим новости
        this.renderNews();
    }

    async waitForSupabase(maxWait = 5000) {
        const startTime = Date.now();
        while (typeof supabase === 'undefined' || !supabase) {
            if (Date.now() - startTime > maxWait) {
                console.warn('Supabase не инициализирован в течение ' + maxWait + 'мс');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async loadNews() {
        try {
            if (typeof supabase === 'undefined' || !supabase) {
                console.warn('Supabase не инициализирован, новости не будут загружены');
                return;
            }

            const { data, error } = await supabase
                .from('main_news')
                .select('*')
                .eq('is_active', true)
                .order('order_index', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Ошибка загрузки новостей:', error);
                return;
            }

            this.news = data || [];
            console.log('Загружено новостей главной страницы:', this.news.length);
        } catch (error) {
            console.error('Ошибка при загрузке новостей:', error);
        }
    }

    buildR2PublicUrl(key) {
        // Получаем базовый URL из r2-config
        const r2Config = window.R2_CONFIG || {};
        const baseUrl = r2Config.IMAGES_PUBLIC_URL || r2Config.PUBLIC_URL || 'https://pub-a797bdf4261e4c448d835644b30caa41.r2.dev';
        
        if (!key) return '';
        
        // Убираем лишние слэши и дубликаты abu-ic/
        let cleanKey = key.replace(/^\/+/, '').replace(/^abu-ic\/abu-ic\//, 'abu-ic/').replace(/^abu-ic\//, '');
        
        // Декодируем URL если он закодирован
        if (cleanKey.includes('%2F')) {
            cleanKey = decodeURIComponent(cleanKey);
        }
        
        const url = `${baseUrl}/${cleanKey}`;
        return url;
    }

    renderNews() {
        const newsSlider = document.getElementById('newsSlider');
        if (!newsSlider) {
            console.warn('Элемент newsSlider не найден');
            return;
        }

        const newsBlockMain = newsSlider.querySelector('.news__block_main');
        if (!newsBlockMain) {
            console.warn('Элемент .news__block_main не найден');
            return;
        }

        if (this.news.length === 0) {
            newsBlockMain.innerHTML = `
                <div class="empty-state" style="width: 100%; text-align: center; padding: 50px;">
                    <i class="fas fa-box-open" style="font-size: 3rem; color: #ccc;"></i>
                    <p style="margin-top: 15px; color: #666;">Новостей пока нет.</p>
                </div>
            `;
            return;
        }

        // Функция создания блока новости
        const createNewsBlock = (news) => {
            const lang = this.currentLanguage.toLowerCase();
            const title = news[`title_${lang}`] || news.title_ru || '';
            const description = news[`description_${lang}`] || news.description_ru || '';
            
            // Исправляем URL изображения
            let imageUrl = news.image_url || '';
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = this.buildR2PublicUrl(imageUrl);
            } else if (imageUrl && imageUrl.includes('abu-ic/abu-ic/')) {
                imageUrl = imageUrl.replace(/abu-ic\/abu-ic\//, 'abu-ic/');
            }
            
            const linkUrl = news.link_url || '#';
            
            return `
                <div class="first__block">
                    <a href="${linkUrl}" ${linkUrl !== '#' ? 'target="_blank" rel="noopener"' : ''}>
                        <div class="news__img">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${title}" loading="lazy">` : '<div class="no-image">Нет изображения</div>'}
                        </div>
                        <div class="news__text">
                            <h3>${title}</h3>
                            <p>${description}</p>
                        </div>
                    </a>
                </div>
            `;
        };

        // Генерируем HTML для новостей
        let newsHTML = '';
        if (this.news.length < 4) {
            newsHTML = this.news.map(news => createNewsBlock(news)).join('');
        } else {
            // Добавляем дубликаты для плавного скролла
            const duplicateCount = Math.max(1, Math.ceil(8 / this.news.length));
            const duplicatedNews = [];
            for (let i = 0; i < duplicateCount; i++) {
                duplicatedNews.push(...this.news);
            }
            newsHTML = duplicatedNews.map(news => createNewsBlock(news)).join('');
        }

        // Заменяем содержимое
        newsBlockMain.innerHTML = newsHTML;
        
        // Убеждаемся что контейнер правильно настроен для скролла
        newsBlockMain.style.display = 'flex';
        newsBlockMain.style.flexWrap = 'nowrap';
        newsBlockMain.style.gap = '24px';

        // Обновляем язык
        this.updateLanguage();

        // Слушаем изменения языка
        window.addEventListener('languageChanged', () => {
            this.currentLanguage = localStorage.getItem('selectedLanguage') || 'RU';
            this.updateLanguage();
        });

        window.addEventListener('storage', (e) => {
            if (e.key === 'selectedLanguage') {
                this.currentLanguage = e.newValue || 'RU';
                this.updateLanguage();
            }
        });

        // Инициализируем кнопки прокрутки
        this.initScrollButtons();
    }

    initScrollButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const slider = document.querySelector('.news__slider-wrapper');

        if (slider && prevBtn && nextBtn) {
            // Удаляем старые обработчики
            const newPrevBtn = prevBtn.cloneNode(true);
            const newNextBtn = nextBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

            // Добавляем новые обработчики
            newNextBtn.addEventListener('click', () => this.scrollNews(1));
            newPrevBtn.addEventListener('click', () => this.scrollNews(-1));
        }
    }

    scrollNews(direction) {
        const slider = document.querySelector('.news__slider-wrapper');
        if (!slider) return;

        const firstBlock = slider.querySelector('.first__block');
        if (!firstBlock) return;

        const blockWidth = firstBlock.offsetWidth;
        const gap = parseInt(window.getComputedStyle(firstBlock.parentNode).gap) || 24;
        const scrollStep = blockWidth + gap;

        slider.scrollBy({ left: direction * scrollStep, behavior: 'smooth' });
    }

    updateLanguage() {
        const lang = this.currentLanguage.toLowerCase();
        const newsBlocks = document.querySelectorAll('#newsSlider .first__block h3, #newsSlider .first__block p');
        
        this.news.forEach((news, index) => {
            const title = news[`title_${lang}`] || news.title_ru || '';
            const description = news[`description_${lang}`] || news.description_ru || '';
            
            // Обновляем текст в блоках (учитываем дубликаты)
            const blockIndex = index % this.news.length;
            const blocks = document.querySelectorAll(`#newsSlider .first__block:nth-child(${blockIndex + 1})`);
            
            blocks.forEach(block => {
                const titleEl = block.querySelector('h3');
                const descEl = block.querySelector('p');
                if (titleEl) titleEl.textContent = title;
                if (descEl) descEl.textContent = description;
            });
        });
    }
}

// Инициализация при загрузке страницы
let mainNewsLoader;

document.addEventListener('DOMContentLoaded', async () => {
    // Ждем инициализации Supabase
    let attempts = 0;
    while (typeof supabase === 'undefined' && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (typeof supabase === 'undefined') {
        console.warn('Supabase не инициализирован, новости не будут загружены');
        return;
    }

    mainNewsLoader = new MainNewsLoader();
    await mainNewsLoader.init();
    
    // Экспортируем для глобального доступа
    window.mainNewsLoader = mainNewsLoader;
});

