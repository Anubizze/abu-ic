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

  // Функция для закрытия меню
  function closeMenu() {
    menuBody.classList.remove('active');
    menuPages.classList.remove('active');
    document.querySelectorAll('.has-submenu.active').forEach(item => {
      item.classList.remove('active');
    });
  }

  // Функция для открытия меню
  function openMenu() {
    menuBody.classList.add('active');
    menuPages.classList.add('active');
  }

  if (burgerBtn && menuBody && menuPages) {
    burgerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (menuBody.classList.contains('active')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  // === ЗАКРЫТИЕ МЕНЮ ПРИ КЛИКЕ НА ССЫЛКИ ===
  const menuLinks = document.querySelectorAll('.menu__pages a');
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Не закрываем меню при клике на подменю-переключатели
      if (link.classList.contains('submenu-toggle')) {
        return;
      }
      
      if (window.innerWidth <= 768) {
        closeMenu();
      }
    });
  });

  // === ЗАКРЫТИЕ МЕНЮ ПРИ КЛИКЕ ВНЕ МЕНЮ ===
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      const isClickInsideMenu = menuBody.contains(e.target);
      const isClickOnBurger = burgerBtn.contains(e.target);
      
      if (!isClickInsideMenu && !isClickOnBurger && menuBody.classList.contains('active')) {
        closeMenu();
      }
    }
  });

  submenuToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = toggle.closest('.has-submenu');

      if (!parent) {
        return;
      }

      // Закрываем все другие подменю
      document.querySelectorAll('.has-submenu').forEach(item => {
        if (item !== parent) {
          item.classList.remove('active');
        }
      });

      // Переключаем текущее подменю
      parent.classList.toggle('active');
      
      // Дополнительная проверка
      const submenu = parent.querySelector('.submenu');
      if (submenu) {
        // Принудительно применяем стили для мобильной версии
        if (window.innerWidth <= 768) {
          if (parent.classList.contains('active')) {
            submenu.style.display = 'flex';
            submenu.style.opacity = '1';
            submenu.style.visibility = 'visible';
            submenu.style.position = 'static';
            submenu.style.left = 'auto';
            submenu.style.right = 'auto';
            submenu.style.top = 'auto';
            submenu.style.transform = 'none';
            submenu.style.width = '100%';
            submenu.style.maxWidth = '100%';
          } else {
            submenu.style.display = 'none';
            submenu.style.opacity = '0';
            submenu.style.visibility = 'hidden';
          }
        }
      }
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      menuPages?.classList.remove('active');
      document.querySelectorAll('.has-submenu.active').forEach(item => {
        item.classList.remove('active');
        const submenu = item.querySelector('.submenu');
        if (submenu) {
          submenu.style.display = '';
          submenu.style.opacity = '';
          submenu.style.visibility = '';
        }
      });
    } else {
      // Сбрасываем inline стили для мобильной версии
      document.querySelectorAll('.submenu').forEach(submenu => {
        submenu.style.display = '';
        submenu.style.opacity = '';
        submenu.style.visibility = '';
        submenu.style.position = '';
        submenu.style.left = '';
        submenu.style.right = '';
        submenu.style.top = '';
        submenu.style.transform = '';
        submenu.style.width = '';
        submenu.style.maxWidth = '';
      });
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
  const isSubmenuLink = e.target.closest('.submenu a');

  if (!isInsideMenu && !isToggleButton && !isSubmenuLink) {
    document.querySelectorAll('.has-submenu.active').forEach(item => {
      item.classList.remove('active');
    });
  }
});
