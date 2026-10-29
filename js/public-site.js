(function () {
  const store = window.SchoolSiteData;
  if (!store) return;

  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));

  function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  }

  function setFormStatus(form, message, isError) {
    const status = form.querySelector("[data-form-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("form-error", Boolean(isError));
  }

  function canSubmitForm(form) {
    return Boolean(store.turnstileSiteKey)
      && (form.dataset.submissionForm !== "admission" || store.get().settings.admissionsOpen);
  }

  function setFormUnavailable(form, message) {
    setFormStatus(form, message, true);
    const status = form.querySelector("[data-form-status]");
    const contactLink = document.querySelector(".whatsapp-float");
    if (status && contactLink) {
      const link = document.createElement("a");
      link.href = contactLink.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = " Contact the school on WhatsApp instead.";
      status.append(link);
    }
  }

  function render(data) {
    const settings = data.settings;
    document.title = document.title.replace(/Your School Name|The Little Harvad(?: Academy)?/gi, settings.schoolName);
    document.querySelectorAll(".school-name h2").forEach(element => {
      element.textContent = settings.schoolName.toUpperCase();
    });
    document.querySelectorAll("[data-school-setting]").forEach(element => {
      const value = settings[element.dataset.schoolSetting];
      if (value !== undefined) element.textContent = value;
    });
    document.querySelectorAll("footer .footer-grid > div:first-child h3").forEach(element => {
      element.textContent = settings.schoolName;
    });
    document.querySelectorAll("footer .footer-grid h3").forEach(heading => {
      if (heading.textContent.trim().toLowerCase() !== "contact") return;
      const details = heading.parentElement.querySelectorAll("p");
      if (details.length >= 3) {
        details[0].textContent = `Phone: ${settings.phone}`;
        details[1].textContent = `Email: ${settings.email}`;
        details[2].textContent = `Address: ${settings.address}`;
      }
    });
    document.querySelectorAll("footer .copyright").forEach(element => {
      element.textContent = element.textContent.replace(/Your School Name|The Little Harvad(?: Academy)?/gi, settings.schoolName);
    });
    document.querySelectorAll("[data-school-href]").forEach(element => {
      const value = settings[element.dataset.schoolHref];
      if (value) element.href = element.dataset.schoolHref === "email" ? `mailto:${value}` : `tel:${value.replace(/[^\d+]/g, "")}`;
    });
    document.querySelectorAll("[data-admissions-status]").forEach(element => {
      element.textContent = settings.admissionsOpen ? "Admissions are open" : "Contact us about future places";
    });
    document.querySelectorAll("[data-submission-form]").forEach(form => {
      const button = form.querySelector('[type="submit"]');
      const hasCaptcha = Boolean(form.querySelector('[name="cf-turnstile-response"]')?.value);
      button.disabled = !store.turnstileSiteKey || !hasCaptcha
        || (form.dataset.submissionForm === "admission" && !settings.admissionsOpen);
    });
    document.querySelectorAll('[data-submission-form="admission"] input, [data-submission-form="admission"] select, [data-submission-form="admission"] textarea').forEach(field => {
      field.disabled = !settings.admissionsOpen;
    });
    if (!settings.admissionsOpen) {
      document.querySelectorAll('[data-submission-form="admission"]').forEach(form => {
        setFormStatus(form, "Online admission enquiries are currently closed. Please contact the school office.", true);
      });
    }

    renderAssets(data.assets || []);
    renderSections(data.sections || []);

    const announcements = data.notices.filter(item => item.published).slice(0, 3);
    document.querySelectorAll("[data-notice-list]").forEach(container => {
      container.innerHTML = announcements.length ? announcements.map(item => `
        <article class="notice-card">
          <span class="content-date">${escapeHtml(formatDate(item.date))}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
        </article>`).join("") : '<p class="empty-state">There are no current notices.</p>';
    });

    const news = data.news.filter(item => item.published)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    document.querySelectorAll("[data-news-list]").forEach(container => {
      container.innerHTML = news.length ? news.map(item => `
        <article class="school-update">
          <div class="update-icon" aria-hidden="true">✦</div>
          <div><span class="content-date">${escapeHtml(formatDate(item.date))}</span>
          <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>
        </article>`).join("") : '<p class="empty-state">School stories will appear here soon.</p>';
    });

    const events = data.events.filter(item => item.published)
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter(item => new Date(`${item.date}T23:59:59`) >= new Date()).slice(0, 4);
    document.querySelectorAll("[data-event-list]").forEach(container => {
      container.innerHTML = events.length ? events.map(item => {
        const date = new Date(`${item.date}T00:00:00`);
        return `<article class="event-card">
          <div class="event-date"><strong>${escapeHtml(Number.isNaN(date.getTime()) ? "" : date.getDate())}</strong>
          <span>${escapeHtml(Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-KE", { month: "short" }))}</span></div>
          <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>
        </article>`;
      }).join("") : '<p class="empty-state">New school events will be posted here.</p>';
    });
  }

  function renderAssets(assets) {
    const published = assets.filter(asset => asset.published);
    document.querySelectorAll("[data-public-downloads]").forEach(container => {
      const downloads = published.filter(asset => asset.kind === "document");
      container.innerHTML = downloads.length ? downloads.map(asset => `
        <article class="download-card">
          <span class="download-file-icon" aria-hidden="true">${asset.contentType === "application/pdf" ? "PDF" : "DOC"}</span>
          <h3>${escapeHtml(asset.title)}</h3>
          ${asset.description ? `<p>${escapeHtml(asset.description)}</p>` : ""}
          <a class="btn-primary" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(asset.fileName)}">Download</a>
        </article>`).join("") : '<p class="empty-state">School downloads will be added here soon. Please contact the school office if you need a document.</p>';
    });
    document.querySelectorAll("[data-admission-documents]").forEach(container => {
      const documents = published.filter(asset => asset.kind === "document" && /admission|fee/i.test(`${asset.title} ${asset.fileName}`));
      container.innerHTML = documents.map(asset => `<a class="underlined-link" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(asset.fileName)}">${escapeHtml(asset.title)} ↓</a>`).join("");
    });

    const currentPage = getPageKey();
    const gallery = published.filter(asset => asset.kind === "gallery" && asset.pageKey === currentPage);
    let galleryContainer = document.querySelector("[data-managed-gallery]");
    if (gallery.length && !galleryContainer) {
      galleryContainer = document.createElement("div");
      galleryContainer.className = "container gallery-grid managed-gallery";
      galleryContainer.dataset.managedGallery = "";
      galleryContainer.dataset.dynamicSection = "true";
      const section = document.createElement("section");
      section.append(galleryContainer);
      document.querySelector("footer")?.before(section);
    }
    if (galleryContainer && gallery.length) {
      galleryContainer.hidden = false;
      galleryContainer.innerHTML = gallery.map(asset => `
        <article class="gallery-item">
          <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.title)}" loading="lazy">
          <div class="gallery-overlay"><h3>${escapeHtml(asset.title)}</h3>${asset.description ? `<p>${escapeHtml(asset.description)}</p>` : ""}</div>
        </article>`).join("");
      if (currentPage === "gallery") {
        document.querySelectorAll(".gallery-grid:not([data-managed-gallery])").forEach(container => { container.hidden = true; });
      }
    } else if (galleryContainer) {
      if (galleryContainer.dataset.dynamicSection) galleryContainer.closest("section")?.remove();
      else {
        galleryContainer.hidden = true;
        galleryContainer.replaceChildren();
      }
    }

    const staff = published.filter(asset => asset.kind === "staff");
    const staffContainer = document.querySelector("[data-managed-staff]");
    if (staffContainer) {
      staffContainer.innerHTML = staff.length ? staff.map(asset => `
        <article class="staff-card">
          <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.personName)}" loading="lazy">
          <h3>${escapeHtml(asset.personName)}</h3>
          <p class="position">${escapeHtml(asset.position)}</p>
          ${asset.department ? `<p>${escapeHtml(asset.department)}</p>` : ""}
          ${asset.description ? `<p>${escapeHtml(asset.description)}</p>` : ""}
          <div class="staff-icons">${asset.email ? `<a href="mailto:${escapeHtml(asset.email)}" aria-label="Email ${escapeHtml(asset.personName)}">Email</a>` : ""}${asset.phone ? `<a href="tel:${escapeHtml(asset.phone.replace(/[^\d+]/g, ""))}" aria-label="Call ${escapeHtml(asset.personName)}">Call</a>` : ""}</div>
        </article>`).join("") : '<p class="empty-state">Staff profiles will be added here soon.</p>';
      document.querySelectorAll(".staff-grid:not([data-managed-staff])").forEach(container => { container.closest("section").hidden = true; });
    }
    document.getElementById("staffSearch")?.dispatchEvent(new Event("input"));
  }

  function renderSections(sections) {
    const pageKey = getPageKey();
    const pageSections = sections.filter(section => section.pageKey === pageKey && section.published);
    let container = document.getElementById("managed-page-sections");
    if (!pageSections.length) {
      container?.remove();
      return;
    }
    if (!container) {
      container = document.createElement("section");
      container.id = "managed-page-sections";
      container.className = "managed-page-sections";
      document.querySelector("footer")?.before(container);
    }
    container.replaceChildren(...pageSections.map(section => {
      const article = document.createElement("article");
      article.className = "container managed-page-section";
      const heading = document.createElement("h2");
      heading.textContent = section.title;
      const body = document.createElement("p");
      body.textContent = section.body;
      article.append(heading, body);
      return article;
    }));
  }

  function getPageKey() {
    const currentPage = location.pathname.split("/").pop().replace(/\.html?$/i, "");
    return !currentPage || currentPage === "index" ? "home" : currentPage;
  }

  function setupWhatsApp(settings) {
    document.querySelectorAll(".whatsapp-float").forEach(link => {
      const number = (settings.phone || "").replace(/\D/g, "");
      if (number.length >= 10) link.href = `https://wa.me/${number}?text=${encodeURIComponent(`Hello ${settings.schoolName}, I would like to make an enquiry.`)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Chat with ${settings.schoolName} on WhatsApp`);
      link.replaceChildren();
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 32 32");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<path fill="currentColor" d="M16.04 3.2A12.72 12.72 0 0 0 5.1 22.4L3.4 28.7l6.47-1.7a12.72 12.72 0 1 0 6.17-23.8Zm0 23.1a10.34 10.34 0 0 1-5.27-1.44l-.38-.23-3.84 1.01 1.02-3.74-.25-.39a10.37 10.37 0 1 1 8.72 4.79Zm5.69-7.77c-.31-.16-1.84-.91-2.13-1.02-.29-.1-.5-.15-.71.16-.21.31-.82 1.02-1 1.23-.19.21-.37.23-.68.08-.31-.16-1.31-.48-2.5-1.53-.92-.82-1.54-1.83-1.72-2.14-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.19.21-.32.31-.53.1-.21.05-.4-.03-.55-.08-.16-.71-1.7-.98-2.32-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.55.08-.84.4-.29.31-1.1 1.07-1.1 2.61s1.13 3.03 1.28 3.24c.16.21 2.22 3.39 5.38 4.76.75.32 1.34.52 1.8.66.76.24 1.45.2 2 .12.61-.09 1.84-.75 2.1-1.48.26-.73.26-1.36.18-1.49-.08-.13-.29-.21-.6-.37Z"/>';
      link.append(icon);
    });
  }

  document.getElementById("staffSearch")?.addEventListener("input", event => {
    const query = event.currentTarget.value.trim().toLocaleLowerCase();
    document.querySelectorAll(".staff-grid .staff-card").forEach(card => {
      card.hidden = !card.textContent.toLocaleLowerCase().includes(query);
    });
  });

  function loadTurnstile() {
    const siteKey = store.turnstileSiteKey;
    const forms = [...document.querySelectorAll("[data-submission-form]")];
    if (!siteKey) {
      forms.forEach(form => {
        form.querySelector('[type="submit"]').disabled = true;
        setFormUnavailable(form, "Online forms are not active yet. Please contact the school directly.");
      });
      return;
    }

    forms.forEach(form => {
      form.querySelector('[type="submit"]').disabled = true;
      let widgetId;
      const widget = form.querySelector("[data-turnstile]");
      if (!widget) return;
      const draw = () => {
        if (!window.turnstile || widgetId !== undefined) return;
        widgetId = window.turnstile.render(widget, {
          sitekey: siteKey,
          callback: () => {
            form.querySelector('[type="submit"]').disabled = !canSubmitForm(form);
            setFormStatus(form, "", false);
          },
          "expired-callback": () => {
            form.querySelector('[type="submit"]').disabled = true;
            setFormUnavailable(form, "Please complete the security check again.");
          },
          "error-callback": () => {
            form.querySelector('[type="submit"]').disabled = true;
            setFormUnavailable(form, "The security check could not load. Refresh and try again.");
          }
        });
        form.querySelector('[type="submit"]').disabled = true;
        widget.dataset.widgetId = widgetId;
      };
      if (window.turnstile) {
        draw();
      } else {
        window.addEventListener("turnstile-ready", draw, { once: true });
      }
    });

    if (!window.turnstile && !document.querySelector('script[data-turnstile-script]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = "true";
      script.onload = () => window.dispatchEvent(new Event("turnstile-ready"));
      script.onerror = () => forms.forEach(form => {
        form.querySelector('[type="submit"]').disabled = true;
        setFormUnavailable(form, "The security check could not load. Refresh and try again.");
      });
      document.head.appendChild(script);
    }
  }

  function bindForms() {
    document.querySelectorAll("[data-submission-form]").forEach(form => {
      if (form.dataset.bound) return;
      form.dataset.bound = "true";
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        const values = Object.fromEntries(new FormData(form).entries());
        const captchaToken = form.querySelector('[name="cf-turnstile-response"]')?.value || "";
        if (!store.turnstileSiteKey) {
          setFormUnavailable(form, "Online forms are not active: the school must configure its protected form service.");
          return;
        }
        if (!captchaToken) {
          setFormUnavailable(form, "Please complete the security check before sending.");
          return;
        }
        submit.disabled = true;
        setFormStatus(form, "Sending securely…", false);
        try {
          await store.submitSubmission(form.dataset.submissionForm, values, captchaToken);
          form.reset();
          if (window.turnstile) {
            const widget = form.querySelector("[data-turnstile]");
            if (widget?.dataset.widgetId !== undefined) window.turnstile.reset(widget.dataset.widgetId);
          }
          setFormStatus(form, "Thank you. Your message has been securely sent to the school office.", false);
        } catch (error) {
          console.error("Could not send public enquiry.", error);
          setFormUnavailable(form, error.message || "Your message could not be sent. Please try again or contact the school directly.");
          const widget = form.querySelector("[data-turnstile]");
          if (window.turnstile && widget?.dataset.widgetId !== undefined) window.turnstile.reset(widget.dataset.widgetId);
        }
      });
    });
  }

  async function refresh() {
    try {
      const data = await store.loadPublic();
      render(data);
      setupWhatsApp(data.settings);
    } catch (error) {
      console.error("Could not load school website content.", error);
      document.querySelectorAll("[data-notice-list], [data-news-list], [data-event-list]").forEach(container => {
        container.innerHTML = '<p class="empty-state">School updates are temporarily unavailable. Please try again shortly.</p>';
      });
      document.querySelectorAll("[data-public-downloads]").forEach(container => {
        container.innerHTML = '<p class="empty-state">Downloads are temporarily unavailable. Please try again shortly.</p>';
      });
      document.querySelectorAll("[data-managed-staff]").forEach(container => {
        container.innerHTML = '<p class="empty-state">Staff profiles are temporarily unavailable. Please try again shortly.</p>';
        document.querySelectorAll(".staff-grid:not([data-managed-staff])").forEach(grid => { grid.closest("section").hidden = true; });
      });
    }
  }

  bindForms();
  if (store.isConfigured()) loadTurnstile();
  else document.querySelectorAll("[data-submission-form]").forEach(form => {
    form.querySelector('[type="submit"]').disabled = true;
    setFormUnavailable(form, "Online forms are not active because the protected Supabase form service is not configured.");
  });
  setupWhatsApp(store.get().settings);
  refresh();

  if (store.isConfigured()) {
    store.ready.then(() => store.subscribe(refresh, error => console.error("Live school updates disconnected.", error)))
      .catch(error => console.error("Could not subscribe to live school updates.", error));
  }
})();
