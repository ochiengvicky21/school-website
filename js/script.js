// =========================================
// Mobile Navigation
// =========================================

const menuBtn = document.querySelector(".menu-btn");
const navLinks = document.querySelector(".nav-links");
const publicPages = [
  ["index.html", "Home"],
  ["about.html", "Our School"],
  ["academics.html", "Learning"],
  ["admissions.html", "Admissions"],
  ["student-life.html", "School Life"],
  ["news.html", "News & Events"],
  ["contact.html", "Contact"]
];
const additionalPages = [
  ["downloads.html", "Downloads"],
  ["gallery.html", "Gallery"],
  ["staff.html", "Staff"],
  ["facilities.html", "Facilities"],
  ["faq.html", "FAQs"]
];

if (navLinks) {
  const currentPage = location.pathname.split("/").pop() || "index.html";
  navLinks.id ||= "site-primary-navigation";
  navLinks.setAttribute("aria-label", "Main navigation");
  navLinks.replaceChildren();

  publicPages.forEach(([href, label]) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    link.classList.toggle("active", href === currentPage);
    if (href === currentPage) link.setAttribute("aria-current", "page");
    item.append(link);
    navLinks.append(item);
  });

  const moreItem = document.createElement("li");
  moreItem.className = "nav-more";
  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "nav-more-toggle";
  moreButton.textContent = "More";
  moreButton.setAttribute("aria-expanded", "false");
  moreButton.setAttribute("aria-controls", "site-nav-more");
  const submenu = document.createElement("ul");
  submenu.className = "nav-submenu";
  submenu.id = "site-nav-more";
  submenu.hidden = true;
  additionalPages.forEach(([href, label]) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    link.classList.toggle("active", href === currentPage);
    if (href === currentPage) {
      link.setAttribute("aria-current", "page");
      moreButton.classList.add("active");
    }
    item.append(link);
    submenu.append(item);
  });
  moreItem.append(moreButton, submenu);
  navLinks.append(moreItem);

  moreButton.addEventListener("click", () => {
    const expanded = moreButton.getAttribute("aria-expanded") !== "true";
    moreButton.setAttribute("aria-expanded", String(expanded));
    moreItem.classList.toggle("open", expanded);
    submenu.hidden = !expanded;
  });
}

if (menuBtn && navLinks) {
  let accessibleMenuBtn = menuBtn;
  if (menuBtn.tagName !== "BUTTON") {
    accessibleMenuBtn = document.createElement("button");
    accessibleMenuBtn.className = menuBtn.className;
    menuBtn.replaceWith(accessibleMenuBtn);
  }

  accessibleMenuBtn.type = "button";
  accessibleMenuBtn.setAttribute("aria-controls", navLinks.id);
  accessibleMenuBtn.setAttribute("aria-label", "Open navigation menu");
  accessibleMenuBtn.setAttribute("aria-expanded", "false");

  const closeMenu = (restoreFocus = false) => {
    navLinks.classList.remove("show");
    accessibleMenuBtn.textContent = "☰";
    accessibleMenuBtn.setAttribute("aria-label", "Open navigation menu");
    accessibleMenuBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) accessibleMenuBtn.focus();
  };

  accessibleMenuBtn.textContent = "☰";
  accessibleMenuBtn.addEventListener("click", () => {
    const expanded = !navLinks.classList.contains("show");
    navLinks.classList.toggle("show", expanded);
    accessibleMenuBtn.textContent = expanded ? "×" : "☰";
    accessibleMenuBtn.setAttribute("aria-label", expanded ? "Close navigation menu" : "Open navigation menu");
    accessibleMenuBtn.setAttribute("aria-expanded", String(expanded));
  });

  navLinks.addEventListener("click", event => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (navLinks.classList.contains("show")) closeMenu(true);
      const moreItem = navLinks.querySelector(".nav-more.open");
      const moreButton = moreItem?.querySelector(".nav-more-toggle");
      if (moreItem && moreButton) {
        moreItem.classList.remove("open");
        moreButton.setAttribute("aria-expanded", "false");
        moreItem.querySelector(".nav-submenu").hidden = true;
        moreButton.focus();
      }
    }
  });

  document.addEventListener("click", event => {
    if (navLinks.classList.contains("show") && !event.target.closest(".navbar")) closeMenu();
  });

  window.matchMedia("(min-width: 1101px)").addEventListener("change", event => {
    if (event.matches) closeMenu();
  });
}

// =========================================
// Sticky Header Shadow
// =========================================

const header = document.querySelector("header");

window.addEventListener("scroll", () => {
  
  if (window.scrollY > 60) {
    
    header.style.background = "#102d38";
    header.style.boxShadow = "0 10px 25px rgba(0,0,0,.25)";
    
  } else {
    
    header.style.background = "#123037";
    header.style.boxShadow = "0 5px 15px rgba(0,0,0,.15)";
    
  }
  
});

// =========================================
// Active Navigation
// =========================================

const links = document.querySelectorAll(".nav-links a");

links.forEach(link => {
  
  link.addEventListener("click", function() {
    
    links.forEach(item => item.classList.remove("active"));
    
    this.classList.add("active");
    
  });
  
});

// =========================================
// Scroll Reveal Animation
// =========================================

const revealItems = document.querySelectorAll(
  ".card, .about-grid div, .principal-grid, .news-grid article, .learning-card, .school-update, .event-card, .staff-card, .gallery-item, .faq-item, .download-card, .school-values article"
);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reducedMotion && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-order", String(index % 5));
    item.classList.add("reveal-on-scroll");
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach(item => item.classList.add("is-visible"));
}

// =========================================
// Animated Statistics
// =========================================

const counters = document.querySelectorAll(".stats h2");

let counted = false;

window.addEventListener("scroll", () => {
  
  const stats = document.querySelector(".statistics");
  
  if (!stats) return;
  
  const statsTop = stats.getBoundingClientRect().top;
  
  if (statsTop < window.innerHeight && !counted) {
    
    counted = true;
    
    counters.forEach(counter => {
      
      const text = counter.innerText;
      
      const number = Number.parseInt(text.replace(/\D/g, ""), 10);
      if (!Number.isFinite(number)) return;
      
      const suffix = text.replace(/[0-9]/g, "");
      
      let count = 0;
      
      const speed = Math.ceil(number / 100);
      
      const update = () => {
        
        count += speed;
        
        if (count >= number) {
          
          counter.innerText = number + suffix;
          
        } else {
          
          counter.innerText = count + suffix;
          
          requestAnimationFrame(update);
          
        }
        
      };
      
      update();
      
    });
    
  }
  
});

// =========================================
// Back To Top Button
// =========================================

const topButton = document.createElement("button");
topButton.type = "button";
topButton.textContent = "↑";
topButton.className = "backToTop";
topButton.setAttribute("aria-label", "Back to top");

document.body.appendChild(topButton);

window.addEventListener("scroll", () => {

  if (window.scrollY > 400) {
    topButton.classList.add("show");
  } else {
    topButton.classList.remove("show");
  }
});

topButton.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: reducedMotion ? "auto" : "smooth"
  });
});

// =========================================
// Hero Fade Animation
// =========================================

window.addEventListener("load", () => {
  
  const hero = document.querySelector(".hero-content");
  
  if (hero && !reducedMotion) {
    
    hero.style.opacity = "0";
    hero.style.transform = "translate(-50%, -40%)";
    
    setTimeout(() => {
      
      hero.style.transition = "1.2s";
      
      hero.style.opacity = "1";
      hero.style.transform = "translate(-50%, -50%)";
      
    }, 300);
    
  }
  
});

// =========================================
// Image Hover Effect
// =========================================

const images = document.querySelectorAll("img");

images.forEach(img => {
  const replaceMissingImage = () => {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "true";
    if (img.src.includes("/facilities/")) {
      img.src = "images/hero.jpg";
    } else if (img.src.includes("/gallery/") || img.src.includes("/news/")) {
      img.src = "images/hero12.jpg";
    } else if (img.src.includes("/staff/") || img.src.includes("/staff-")) {
      img.src = "images/principal.jpg";
    }
  };

  img.addEventListener("error", replaceMissingImage);
  if (img.complete && img.naturalWidth === 0) replaceMissingImage();
  
  img.addEventListener("mouseenter", () => {
    
    img.style.transition = ".4s";
    
    img.style.transform = "scale(1.03)";
    
  });
  
  img.addEventListener("mouseleave", () => {
    
    img.style.transform = "scale(1)";
    
  });
  
});
/* ===========================
FAQ ACCORDION
=========================== */

const faqQuestions = document.querySelectorAll(".faq-question");

faqQuestions.forEach(question => {
  
  question.addEventListener("click", () => {
    
    const item = question.parentElement;
    
    const answer = item.querySelector(".faq-answer");
    
    const icon = question.querySelector("i");
    
    document.querySelectorAll(".faq-item").forEach(faq => {
      
      if (faq !== item) {
        
        faq.querySelector(".faq-answer").style.maxHeight = null;
        
        faq.querySelector("i").classList.remove("fa-minus");
        
        faq.querySelector("i").classList.add("fa-plus");
        
      }
      
    });
    
    if (answer.style.maxHeight) {
      
      answer.style.maxHeight = null;
      
      icon.classList.remove("fa-minus");
      
      icon.classList.add("fa-plus");
      
    } else {
      
      answer.style.maxHeight = answer.scrollHeight + "px";
      
      icon.classList.remove("fa-plus");
      
      icon.classList.add("fa-minus");
      
    }
    
  });
  
});
/* ==========================================
HERO SLIDER
========================================== */

const slides = document.querySelectorAll(".slide");
const dots = document.querySelectorAll(".dot");

let currentSlide = 0;

function showSlide(index) {
  
  slides.forEach(slide => slide.classList.remove("active"));
  
  dots.forEach(dot => dot.classList.remove("active"));
  
  slides[index].classList.add("active");
  
  dots[index].classList.add("active");
  
}

function nextSlide() {
  
  currentSlide++;
  
  if (currentSlide >= slides.length) {
    
    currentSlide = 0;
    
  }
  
  showSlide(currentSlide);
  
}

function prevSlide() {
  
  currentSlide--;
  
  if (currentSlide < 0) {
    
    currentSlide = slides.length - 1;
    
  }
  
  showSlide(currentSlide);
  
}

if (slides.length) {
  setInterval(nextSlide, 5000);

  const nextButton = document.getElementById("nextSlide");
  const previousButton = document.getElementById("prevSlide");

  if (nextButton) nextButton.onclick = nextSlide;
  if (previousButton) previousButton.onclick = prevSlide;

  dots.forEach((dot, index) => {
    dot.onclick = () => {
      currentSlide = index;
      showSlide(index);
    };
  });
}