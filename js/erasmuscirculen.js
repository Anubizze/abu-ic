    // Инициализация каруселей
        document.addEventListener('DOMContentLoaded', function() {
            initCarousel('carousel-fhm', 6);
            initCarousel('carousel-usc', 6);
            initCarousel('carousel-unf', 4);
        });

        // Функция инициализации карусели
        function initCarousel(carouselId, itemsCount) {
            const carousel = document.getElementById(carouselId);
            const inner = carousel.querySelector('.carousel-inner');
            const indicatorsContainer = carousel.querySelector('.carousel-indicators');
            
            // Создаем индикаторы
            for (let i = 0; i < itemsCount; i++) {
                const indicator = document.createElement('div');
                indicator.className = 'carousel-indicator' + (i === 0 ? ' active' : '');
                indicator.onclick = () => goToSlide(carouselId, i);
                indicatorsContainer.appendChild(indicator);
            }
            
            // Сохраняем количество элементов
            carousel.dataset.items = itemsCount;
            carousel.dataset.current = 0;
        }

        // Функция перемещения карусели
        function moveCarousel(carouselId, direction) {
            const carousel = document.getElementById(carouselId);
            const inner = carousel.querySelector('.carousel-inner');
            const itemsCount = parseInt(carousel.dataset.items);
            let current = parseInt(carousel.dataset.current);
            
            current += direction;
            
            if (current >= itemsCount) current = 0;
            if (current < 0) current = itemsCount - 1;
            
            inner.style.transform = `translateX(-${current * 100}%)`;
            carousel.dataset.current = current;
            
            // Обновляем индикаторы
            const indicators = carousel.querySelectorAll('.carousel-indicator');
            indicators.forEach((ind, index) => {
                ind.classList.toggle('active', index === current);
            });
        }

        // Функция перехода к конкретному слайду
        function goToSlide(carouselId, slideIndex) {
            const carousel = document.getElementById(carouselId);
            const inner = carousel.querySelector('.carousel-inner');
            
            inner.style.transform = `translateX(-${slideIndex * 100}%)`;
            carousel.dataset.current = slideIndex;
            
            // Обновляем индикаторы
            const indicators = carousel.querySelectorAll('.carousel-indicator');
            indicators.forEach((ind, index) => {
                ind.classList.toggle('active', index === slideIndex);
            });
        }

         // Инициализация каруселей при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            initCarousel('carousel-fhm', 9); // 9 фото для FHM
            initCarousel('carousel-usc', 6); // 6 фото для USC
            initCarousel('carousel-unf', 4); // 4 фото для UNF
        });

        // Функция инициализации карусели
        function initCarousel(carouselId, itemsCount) {
            const carousel = document.getElementById(carouselId);
            const indicatorsContainer = document.getElementById(`indicators-${carouselId.split('-')[1]}`);
            
            // Очищаем существующие индикаторы
            indicatorsContainer.innerHTML = '';
            
            // Создаем индикаторы
            for (let i = 0; i < itemsCount; i++) {
                const indicator = document.createElement('div');
                indicator.className = 'carousel-indicator' + (i === 0 ? ' active' : '');
                indicator.onclick = () => goToSlide(carouselId, i);
                indicatorsContainer.appendChild(indicator);
            }
            
            // Сохраняем количество элементов
            carousel.dataset.items = itemsCount;
            carousel.dataset.current = 0;
        }

        // Функция перемещения карусели
        function moveCarousel(carouselId, direction) {
            const carousel = document.getElementById(carouselId);
            const inner = carousel.querySelector('.carousel-inner');
            const itemsCount = parseInt(carousel.dataset.items);
            let current = parseInt(carousel.dataset.current);
            
            current += direction;
            
            if (current >= itemsCount) current = 0;
            if (current < 0) current = itemsCount - 1;
            
            inner.style.transform = `translateX(-${current * 100}%)`;
            carousel.dataset.current = current;
            
            // Обновляем индикаторы
            updateIndicators(carouselId, current);
        }

        // Функция перехода к конкретному слайду
        function goToSlide(carouselId, slideIndex) {
            const carousel = document.getElementById(carouselId);
            const inner = carousel.querySelector('.carousel-inner');
            
            inner.style.transform = `translateX(-${slideIndex * 100}%)`;
            carousel.dataset.current = slideIndex;
            
            // Обновляем индикаторы
            updateIndicators(carouselId, slideIndex);
        }

        // Функция обновления индикаторов
        function updateIndicators(carouselId, currentIndex) {
            const indicatorsContainer = document.getElementById(`indicators-${carouselId.split('-')[1]}`);
            const indicators = indicatorsContainer.querySelectorAll('.carousel-indicator');
            
            indicators.forEach((ind, index) => {
                ind.classList.toggle('active', index === currentIndex);
            });
        }

        // Автоматическое перелистывание (опционально)
        function startAutoSlide(carouselId, interval = 5000) {
            setInterval(() => {
                moveCarousel(carouselId, 1);
            }, interval);
        }

        // Запуск авто-перелистывания (можно включить для нужных каруселей)
        // startAutoSlide('carousel-fhm');
        // новая часть 
       document.addEventListener("DOMContentLoaded", () => {
  // === ЯЗЫКОВОЙ ПЕРЕКЛЮЧАТЕЛЬ ===
  const languages = ["KZ", "RU", "EN"];
  let currentIndex = 0;

  const button = document.getElementById("language-button");
  const label = document.getElementById("language-label");

  if (button && label) {
    button.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % languages.length;
      label.textContent = languages[currentIndex];
    });
  }

  // === СЛАЙДЕР НОВОСТЕЙ ===
  const slider = document.querySelector(".news__slider-wrapper");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (slider && prevBtn && nextBtn) {
    const slideStep = 446 + 24;
    nextBtn.addEventListener("click", () => slider.scrollBy({ left: slideStep, behavior: "smooth" }));
    prevBtn.addEventListener("click", () => slider.scrollBy({ left: -slideStep, behavior: "smooth" }));
  }

  // === БУРГЕР-МЕНЮ ===
  const burgerBtn = document.getElementById('burger-button');
  const menuBody = document.getElementById('menu-body');
  const menuPages = document.querySelector('.menu__pages');
  const submenuToggles = document.querySelectorAll('.submenu-toggle');

  if (burgerBtn && menuBody && menuPages) {
    burgerBtn.addEventListener('click', () => {
      menuBody.classList.toggle('active');
      menuPages.classList.toggle('active');
    });
  }

  submenuToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        const parent = toggle.closest('.has-submenu');

        document.querySelectorAll('.has-submenu').forEach(item => {
          if (item !== parent) item.classList.remove('active');
        });

        parent.classList.toggle('active');
      }
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      menuPages?.classList.remove('active');
      document.querySelectorAll('.submenu.active').forEach(sub => sub.classList.remove('active'));
    }
  });

  // === АККОРДЕОНЫ ===
  document.querySelectorAll('.accordion-toggle').forEach(button => {
    button.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;
      const content = button.nextElementSibling;
      if (!content || !content.classList.contains('accordion-content')) return;

      document.querySelectorAll('.accordion-content').forEach(el => {
        if (el !== content) el.style.display = 'none';
      });

      content.style.display = content.style.display === 'block' ? 'none' : 'block';
    });
  });

  // === УТИЛИТА ДЛЯ ЗАКРЫТИЯ ВСЕХ МОДАЛОК ===
  function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
  }

  // === УНИВЕРСАЛЬНАЯ НАСТРОЙКА МОДАЛКИ ===
  function setupModal(openId, modalId, closeId) {
    const openBtn = document.getElementById(openId);
    const modal = document.getElementById(modalId);
    const closeBtn = document.getElementById(closeId);

    if (openBtn && modal && closeBtn) {
      openBtn.addEventListener("click", () => {
        closeAllModals();
        modal.style.display = "flex";
      });

      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });

      window.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });
    }
  }

  // === 🇰🇿 МОДАЛКИ СТРАН ===
  setupModal("openModalKazakhstan", "modalKazakhstan", "closeModalKazakhstan");
  setupModal("openModalSemey", "modalSemey", "closeModalSemey");

  // ===  МОДАЛКИ УНИВЕРСИТЕТОВ ===
  document.querySelectorAll('.btn-universities').forEach(button => {
    button.addEventListener('click', () => {
      const country = button.getAttribute('data-country');
      const modal = document.getElementById(`modal-${country}`);
      if (modal) {
        closeAllModals();
        modal.style.display = "flex";
      }
    });
  });

  // === ЗАКРЫТИЕ ПО X ===
  document.querySelectorAll('.modal .close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  // === ЗАКРЫТИЕ ПО ФОНУ ===
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.style.display = 'none';
    }
  });

  // === НА СТАРТЕ — ВСЕ МОДАЛКИ СКРЫТЫ ===
  closeAllModals();
});

// === ЗАКРЫТИЕ ВЫПАДАЮЩИХ МЕНЮ ПРИ КЛИКЕ ВНЕ ===
document.addEventListener('click', (e) => {
  const isInsideMenu = e.target.closest('.has-submenu');
  const isToggleButton = e.target.classList.contains('submenu-toggle');

  if (!isInsideMenu && !isToggleButton) {
    document.querySelectorAll('.has-submenu.active').forEach(item => {
      item.classList.remove('active');
    });
  }
});
