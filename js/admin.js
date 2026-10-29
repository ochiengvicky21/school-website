(function () {
  const store = window.SchoolSiteData;
  const titles = {
    overview: "Overview",
    news: "News & stories",
    events: "Events",
    notices: "Notice board",
    site: "Website media & sections",
    inbox: "Admissions & inbox",
    settings: "School details"
  };
  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
  const formatDate = value => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  };
  const today = new Date().toISOString().slice(0, 10);
  const authScreen = document.getElementById("auth-screen");
  const app = document.getElementById("admin-app");
  const loginError = document.getElementById("login-error");
  const globalFeedback = document.getElementById("global-feedback");
  let activeRole = null;
  let currentData = null;
  let refreshInProgress = false;

  function notify(message, error = false) {
    globalFeedback.textContent = message;
    globalFeedback.classList.toggle("show", Boolean(message));
    globalFeedback.classList.toggle("error", error);
    if (message) window.setTimeout(() => globalFeedback.classList.remove("show"), 3800);
  }

  function showLogin(message = "") {
    app.hidden = true;
    authScreen.hidden = false;
    loginError.textContent = message;
  }

  function showApp(user, role) {
    activeRole = role;
    authScreen.hidden = true;
    app.hidden = false;
    document.getElementById("staff-identity").textContent = `${user.email} · ${role}`;
    const permissions = store.allowedPanels(role);
    document.querySelectorAll(".admin-nav [data-panel]").forEach(button => {
      button.hidden = !permissions.includes(button.dataset.panel);
    });
    document.querySelectorAll("[data-go]").forEach(button => {
      button.hidden = !permissions.includes(button.dataset.go);
    });
    document.getElementById("export-data").hidden = role !== "admin";
    document.querySelector(".import-button").hidden = role !== "admin";
    document.getElementById("clear-handled").hidden = role !== "admin";
    if (!permissions.includes(document.querySelector(".admin-nav button.active")?.dataset.panel)) {
      openPanel(permissions.includes("inbox") ? "inbox" : "overview");
    }
  }

  function openPanel(name) {
    const permissions = store.allowedPanels(activeRole);
    if (!permissions.includes(name)) {
      notify("Your staff role does not have access to that section.", true);
      return;
    }
    document.querySelectorAll(".admin-panel").forEach(panel => panel.classList.toggle("active", panel.id === `panel-${name}`));
    document.querySelectorAll(".admin-nav button").forEach(button => button.classList.toggle("active", button.dataset.panel === name));
    document.getElementById("page-title").textContent = titles[name] || titles.overview;
  }

  function canReplyTo(item) {
    if (activeRole === "admin") return true;
    if (activeRole === "admissions") return ["admission", "visit"].includes(item.type);
    if (activeRole === "communications") return ["contact", "visit", "newsletter"].includes(item.type);
    return false;
  }

  function renderContentList(key) {
    const list = document.querySelector(`[data-content-list="${key}"]`);
    const entries = [...currentData[key]].sort((a, b) => b.date.localeCompare(a.date));
    const canDelete = activeRole === "admin";
    list.innerHTML = entries.length ? entries.map(item => `
      <article class="managed-item">
        <div class="managed-copy"><strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(formatDate(item.date))} · <span class="status-tag ${item.published ? "" : "draft"}">${item.published ? "Published" : "Draft"}</span></small>
          <p>${escapeHtml(item.body)}</p></div>
        <div class="managed-actions"><button class="icon-button" type="button" data-edit-content="${key}" data-id="${escapeHtml(item.id)}">Edit</button><button class="icon-button" type="button" data-toggle-content="${key}" data-id="${escapeHtml(item.id)}">${item.published ? "Unpublish" : "Publish"}</button>
        ${canDelete ? `<button class="icon-button danger" type="button" data-delete-content="${key}" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">Delete</button>` : ""}</div>
      </article>`).join("") : '<p class="empty-state">Nothing here yet. Use the form to add the first item.</p>';
  }

  function renderInbox() {
    const inbox = document.getElementById("inbox-list");
    const messages = [...currentData.submissions].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    inbox.innerHTML = messages.length ? messages.map(item => {
      const name = item.parentName || item.name || "New enquiry";
      const email = item.email || "";
      const phone = item.phone || "";
      const kind = item.type === "admission" ? "Admission enquiry"
        : item.type === "newsletter" ? "Newsletter subscription"
          : item.type === "visit" ? "Campus visit request" : "Contact message";
      const replyForm = canReplyTo(item) ? `
        <form class="reply-form" data-reply-form="${escapeHtml(item.id)}">
          ${item.reply ? `<p class="previous-reply"><strong>Previous reply:</strong> ${escapeHtml(item.reply)}</p>` : ""}
          <label class="sr-only" for="reply-${escapeHtml(item.id)}">Reply to ${escapeHtml(name)}</label>
          <textarea id="reply-${escapeHtml(item.id)}" name="reply" rows="3" maxlength="5000" required placeholder="Write an email reply to this family"></textarea>
          <button type="submit" class="button button-primary">${item.repliedAt ? "Send another reply" : "Reply by email"}</button>
          <p class="form-feedback" aria-live="polite"></p>
        </form>` : "";
      const canDelete = activeRole === "admin";
      return `<article class="inbox-row">
        <div class="inbox-meta"><strong>${escapeHtml(name)}</strong><span class="status-tag ${item.status === "Handled" ? "draft" : ""}">${escapeHtml(item.status || "New")}</span><span>${kind}</span>
          <time>${escapeHtml(new Date(item.receivedAt).toLocaleString("en-KE"))}</time></div>
        <div class="inbox-body">${escapeHtml(item.message || item.additionalInfo || "No additional message provided.")}</div>
        <div class="inbox-contact">${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : ""}${email && phone ? " · " : ""}${phone ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>` : ""}${item.studentName ? ` · Learner: ${escapeHtml(item.studentName)}` : ""}${item.grade ? ` · Grade: ${escapeHtml(item.grade)}` : ""}${item.department ? ` · Department: ${escapeHtml(item.department)}` : ""}${item.subject ? ` · Subject: ${escapeHtml(item.subject)}` : ""}${item.visitDate ? ` · Visit date: ${escapeHtml(formatDate(item.visitDate))}` : ""}</div>
        <div class="inbox-actions"><button class="icon-button" type="button" data-toggle-message="${escapeHtml(item.id)}">${item.status === "Handled" ? "Reopen" : "Mark handled"}</button>${canDelete ? `<button class="icon-button danger" type="button" data-delete-message="${escapeHtml(item.id)}">Delete</button>` : ""}</div>
        ${replyForm}
      </article>`;
    }).join("") : '<p class="empty-state">No enquiries yet. New admissions and contact messages will appear here.</p>';
  }

  function renderAssets() {
    const list = document.getElementById("asset-list");
    const canDelete = activeRole === "admin";
    list.innerHTML = currentData.assets.length ? currentData.assets.map(asset => {
      const kind = asset.kind === "document" ? "Download" : asset.kind === "gallery" ? "Gallery photo" : "Staff profile";
      const details = asset.kind === "staff"
        ? `${asset.personName} · ${asset.position}${asset.department ? ` · ${asset.department}` : ""}`
        : asset.fileName;
      return `<article class="managed-item">
        <div class="managed-copy"><strong>${escapeHtml(asset.title)}</strong>
          <small>${escapeHtml(kind)} · <span class="status-tag ${asset.published ? "" : "draft"}">${asset.published ? "Published" : "Draft"}</span></small>
          <p>${escapeHtml(details)}${asset.description ? `<br>${escapeHtml(asset.description)}` : ""}</p>
        </div>
        <div class="managed-actions"><a class="icon-button" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer">View</a>
          <button class="icon-button" type="button" data-edit-asset="${escapeHtml(asset.id)}">Replace</button>
          ${canDelete ? `<button class="icon-button danger" type="button" data-delete-asset="${escapeHtml(asset.id)}">Delete</button>` : ""}
        </div>
      </article>`;
    }).join("") : '<p class="empty-state">No public uploads yet. Add a fee schedule, admission form, photo or staff profile.</p>';
  }

  function renderSections() {
    const list = document.getElementById("section-list");
    const canDelete = activeRole === "admin";
    list.innerHTML = currentData.sections.length ? currentData.sections.map(section => `
      <article class="managed-item">
        <div class="managed-copy"><strong>${escapeHtml(section.title)}</strong>
          <small>${escapeHtml(section.pageKey)} · <span class="status-tag ${section.published ? "" : "draft"}">${section.published ? "Published" : "Draft"}</span></small>
          <p>${escapeHtml(section.body)}</p>
        </div>
        <div class="managed-actions"><button class="icon-button" type="button" data-edit-section="${escapeHtml(section.id)}">Edit</button>
          ${canDelete ? `<button class="icon-button danger" type="button" data-delete-section="${escapeHtml(section.id)}">Delete</button>` : ""}
        </div>
      </article>`).join("") : '<p class="empty-state">No custom page sections yet.</p>';
  }

  function render(data) {
    currentData = data;
    document.getElementById("cms-setup-warning").hidden = data.cmsReady;
    const publishedCount = key => data[key].filter(item => item.published).length;
    document.getElementById("metric-news").textContent = publishedCount("news");
    document.getElementById("metric-events").textContent = data.events.filter(item =>
      item.published && new Date(`${item.date}T23:59:59`) >= new Date()).length;
    const openMessages = data.submissions.filter(item => item.status !== "Handled").length;
    document.getElementById("metric-inbox").textContent = openMessages;
    document.getElementById("inbox-count").textContent = openMessages;

    ["news", "events", "notices"].forEach(renderContentList);

    const recent = [...data.news.map(item => ({ ...item, category: "Story" })),
      ...data.events.map(item => ({ ...item, category: "Event" })),
      ...data.notices.map(item => ({ ...item, category: "Notice" }))]
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    document.getElementById("recent-content").innerHTML = recent.length ? recent.map(item => `
      <div class="recent-item"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(formatDate(item.date))}</small></div>
      <span class="status-tag ${item.published ? "" : "draft"}">${item.published ? "Live" : "Draft"}</span></div>`).join("") : '<p class="empty-state">Your published content will appear here.</p>';

    renderInbox();
    renderAssets();
    renderSections();
    const settingsForm = document.getElementById("settings-form");
    Object.entries(data.settings).forEach(([name, value]) => {
      const field = settingsForm.elements.namedItem(name);
      if (field && field.type === "checkbox") field.checked = Boolean(value);
      else if (field) field.value = value;
    });
  }

  async function refresh() {
    if (refreshInProgress || app.hidden) return;
    refreshInProgress = true;
    try {
      const result = await store.loadAdmin();
      activeRole = result.role;
      showApp(result.user, result.role);
      render(result.data);
    } catch (error) {
      console.error("Could not load school office data.", error);
      if (/staff role|access that section|access the school office/i.test(error.message || "")) {
        await store.signOut().catch(signOutError => console.error("Could not end a revoked staff session.", signOutError));
        showLogin(error.message);
        return;
      }
      notify(error.message || "The school office data could not be loaded.", true);
    } finally {
      refreshInProgress = false;
    }
  }

  async function bootstrap() {
    if (!store.isConfigured()) {
      showLogin(store.configurationError());
      return;
    }
    try {
      await store.ready;
      const session = await store.getSession();
      if (!session.user) {
        showLogin();
        return;
      }
      if (!session.role) {
        await store.signOut();
        showLogin("This account has no assigned school staff role. Ask your administrator for access.");
        return;
      }
      showApp(session.user, session.role);
      const result = await store.loadAdmin();
      render(result.data);
      store.subscribe(refresh, error => notify(error.message, true));
      window.setInterval(refresh, 60000);
    } catch (error) {
      console.error("Could not connect to the school office.", error);
      showLogin(error.message || "The school office could not connect to Supabase.");
    }
  }

  document.getElementById("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    loginError.textContent = "";
    try {
      await store.ready;
      const result = await store.signIn(form.elements.email.value.trim(), form.elements.password.value);
      showApp(result.user, result.role);
      const data = await store.loadAdmin();
      render(data.data);
      store.subscribe(refresh, error => notify(error.message, true));
      window.setInterval(refresh, 60000);
    } catch (error) {
      console.error("Staff sign-in failed.", error);
      loginError.textContent = error.message || "Sign-in failed. Check your account and try again.";
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("sign-out").addEventListener("click", async () => {
    try {
      await store.signOut();
      showLogin("You have signed out.");
    } catch (error) {
      console.error("Could not sign out.", error);
      notify(error.message, true);
    }
  });

  document.querySelector(".admin-nav").addEventListener("click", event => {
    const button = event.target.closest("[data-panel]");
    if (button && !button.hidden) openPanel(button.dataset.panel);
  });
  document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => openPanel(button.dataset.go)));

  document.querySelectorAll("[data-content-form]").forEach(form => {
    const category = form.dataset.contentForm;
    const defaultTitle = form.querySelector("[data-form-title]").textContent;
    const submitButton = form.querySelector("[data-submit-label]");
    const defaultLabel = submitButton.dataset.submitLabel;
    form.elements.date.value = today;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const id = form.elements.contentId.value;
      const content = {
        ...(id ? { id } : {}),
        title: form.elements.title.value.trim(),
        body: form.elements.body.value.trim(),
        date: form.elements.date.value,
        published: form.elements.published.checked
      };
      submitButton.disabled = true;
      try {
        await store.upsertContent(category, content);
        await refresh();
        form.reset();
        form.elements.contentId.value = "";
        form.elements.date.value = today;
        form.elements.published.checked = true;
        form.querySelector("[data-form-title]").textContent = defaultTitle;
        submitButton.textContent = defaultLabel;
        form.querySelector(".form-feedback").textContent = id ? "Changes saved." : "Published to the public website.";
      } catch (error) {
        console.error("Could not save school content.", error);
        form.querySelector(".form-feedback").textContent = error.message || "The content could not be saved.";
        form.querySelector(".form-feedback").classList.add("form-error");
      } finally {
        submitButton.disabled = false;
      }
    });
  });

  document.addEventListener("click", async event => {
    const toggle = event.target.closest("[data-toggle-content]");
    const remove = event.target.closest("[data-delete-content]");
    const edit = event.target.closest("[data-edit-content]");
    const messageToggle = event.target.closest("[data-toggle-message]");
    const messageDelete = event.target.closest("[data-delete-message]");
    if (toggle) {
      const item = currentData[toggle.dataset.toggleContent].find(entry => entry.id === toggle.dataset.id);
      if (!item) return;
      try {
        await store.upsertContent(toggle.dataset.toggleContent, { ...item, published: !item.published });
        await refresh();
      } catch (error) {
        notify(error.message || "The publishing status could not be changed.", true);
      }
    } else if (edit) {
      const category = edit.dataset.editContent;
      const item = currentData[category].find(entry => entry.id === edit.dataset.id);
      if (!item) return;
      openPanel(category);
      const form = document.querySelector(`[data-content-form="${category}"]`);
      form.elements.contentId.value = item.id;
      form.elements.title.value = item.title;
      form.elements.body.value = item.body;
      form.elements.date.value = item.date;
      form.elements.published.checked = item.published;
      form.querySelector("[data-form-title]").textContent = `Edit ${category === "news" ? "story" : category.slice(0, -1)}`;
      form.querySelector("[data-submit-label]").textContent = "Save changes";
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (remove) {
      try {
        await store.deleteContent(remove.dataset.id);
        await refresh();
        notify("Content deleted.");
      } catch (error) {
        notify(error.message || "The content could not be deleted.", true);
      }
    } else if (messageToggle) {
      const item = currentData.submissions.find(entry => entry.id === messageToggle.dataset.toggleMessage);
      if (!item) return;
      try {
        await store.updateSubmissionStatus(item.id, item.status === "Handled" ? "New" : "Handled");
        await refresh();
      } catch (error) {
        notify(error.message || "The message status could not be updated.", true);
      }
    } else if (messageDelete) {
      try {
        await store.deleteSubmission(messageDelete.dataset.deleteMessage);
        await refresh();
        notify("Message deleted.");
      } catch (error) {
        notify(error.message || "The message could not be deleted.", true);
      }
    }
  });

  document.addEventListener("submit", async event => {
    const form = event.target.closest("[data-reply-form]");
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const message = form.elements.reply.value.trim();
    button.disabled = true;
    form.querySelector(".form-feedback").textContent = "Sending reply…";
    try {
      await store.sendReply(form.dataset.replyForm, message);
      await refresh();
      notify("Email reply sent to the family.");
    } catch (error) {
      console.error("Could not send family reply.", error);
      form.querySelector(".form-feedback").textContent = error.message || "The reply could not be sent.";
      form.querySelector(".form-feedback").classList.add("form-error");
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("clear-handled").addEventListener("click", async () => {
    const handled = currentData.submissions.filter(item => item.status === "Handled");
    if (!handled.length) {
      notify("There are no handled messages to clear.");
      return;
    }
    if (!window.confirm(`Permanently delete ${handled.length} handled message(s)?`)) return;
    try {
      for (const item of handled) await store.deleteSubmission(item.id);
      await refresh();
      notify("Handled messages deleted.");
    } catch (error) {
      notify(error.message || "Some handled messages could not be deleted.", true);
    }
  });

  document.getElementById("settings-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const settings = {};
    ["schoolName", "motto", "headline", "introduction", "phone", "email", "address"].forEach(name => {
      settings[name] = form.elements[name].value.trim();
    });
    settings.admissionsOpen = form.elements.admissionsOpen.checked;
    try {
      await store.updateSettings(settings);
      await refresh();
      notify("School details published.");
    } catch (error) {
      console.error("Could not save school settings.", error);
      form.querySelector(".form-feedback").textContent = error.message || "School details could not be saved.";
      form.querySelector(".form-feedback").classList.add("form-error");
    }
  });

  const assetForm = document.getElementById("asset-form");
  const assetKind = assetForm.elements.kind;
  const staffFields = assetForm.querySelector("[data-staff-fields]");
  const galleryFields = assetForm.querySelector("[data-gallery-fields]");
  const cancelAssetEdit = document.getElementById("cancel-asset-edit");
  function updateAssetFormKind() {
    const isStaff = assetKind.value === "staff";
    staffFields.hidden = !isStaff;
    galleryFields.hidden = assetKind.value !== "gallery";
    for (const field of staffFields.querySelectorAll("input")) field.required = isStaff && ["personName", "position"].includes(field.name);
    assetForm.elements.file.accept = assetKind.value === "document" ? ".pdf,.doc,.docx" : ".jpg,.jpeg,.png,.webp";
  }
  function resetAssetForm() {
    assetForm.reset();
    assetForm.elements.assetId.value = "";
    assetKind.disabled = false;
    cancelAssetEdit.hidden = true;
    document.getElementById("asset-form-title").textContent = "Add a website upload";
    updateAssetFormKind();
  }
  assetKind.addEventListener("change", updateAssetFormKind);
  cancelAssetEdit.addEventListener("click", resetAssetForm);
  updateAssetFormKind();

  assetForm.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = form.querySelector(".form-feedback");
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    feedback.textContent = "Uploading securely…";
    feedback.classList.remove("form-error");
    try {
      await store.saveAsset({
        id: form.elements.assetId.value || undefined,
        kind: assetKind.value,
        pageKey: form.elements.imagePageKey.value,
        file: form.elements.file.files[0],
        title: form.elements.title.value,
        description: form.elements.description.value,
        personName: form.elements.personName.value,
        position: form.elements.position.value,
        department: form.elements.department.value,
        email: form.elements.email.value,
        phone: form.elements.phone.value
      });
      resetAssetForm();
      feedback.textContent = "Upload saved to the public website.";
      await refresh();
    } catch (error) {
      console.error("Could not save school website upload.", error);
      feedback.textContent = error.message || "The upload could not be saved.";
      feedback.classList.add("form-error");
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("asset-list").addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-asset]");
    const remove = event.target.closest("[data-delete-asset]");
    if (edit) {
      const asset = currentData.assets.find(item => item.id === edit.dataset.editAsset);
      if (!asset) return;
      assetForm.elements.assetId.value = asset.id;
      assetKind.value = asset.kind;
      assetKind.disabled = true;
      assetForm.elements.imagePageKey.value = asset.pageKey || "gallery";
      assetForm.elements.title.value = asset.title;
      assetForm.elements.description.value = asset.description || "";
      assetForm.elements.personName.value = asset.personName || "";
      assetForm.elements.position.value = asset.position || "";
      assetForm.elements.department.value = asset.department || "";
      assetForm.elements.email.value = asset.email || "";
      assetForm.elements.phone.value = asset.phone || "";
      assetForm.elements.file.value = "";
      assetForm.elements.file.required = true;
      cancelAssetEdit.hidden = false;
      document.getElementById("asset-form-title").textContent = "Replace website upload";
      updateAssetFormKind();
      assetForm.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (remove) {
      remove.disabled = true;
      try {
        await store.deleteAsset(remove.dataset.deleteAsset);
        await refresh();
        notify("Upload removed from the public website.");
      } catch (error) {
        notify(error.message || "The upload could not be deleted.", true);
      } finally {
        remove.disabled = false;
      }
    }
  });

  const sectionForm = document.getElementById("section-form");
  const cancelSectionEdit = document.getElementById("cancel-section-edit");
  function resetSectionForm() {
    sectionForm.reset();
    sectionForm.elements.sectionId.value = "";
    sectionForm.elements.pageKey.value = "home";
    sectionForm.elements.published.checked = true;
    cancelSectionEdit.hidden = true;
    document.getElementById("section-form-title").textContent = "Add a page section";
  }
  cancelSectionEdit.addEventListener("click", resetSectionForm);
  sectionForm.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = form.querySelector(".form-feedback");
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    feedback.textContent = "Saving section…";
    feedback.classList.remove("form-error");
    try {
      await store.saveSection({
        id: form.elements.sectionId.value || undefined,
        pageKey: form.elements.pageKey.value,
        title: form.elements.title.value,
        body: form.elements.body.value,
        published: form.elements.published.checked
      });
      resetSectionForm();
      feedback.textContent = "Page section saved.";
      await refresh();
    } catch (error) {
      console.error("Could not save website page section.", error);
      feedback.textContent = error.message || "The page section could not be saved.";
      feedback.classList.add("form-error");
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("section-list").addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-section]");
    const remove = event.target.closest("[data-delete-section]");
    if (edit) {
      const section = currentData.sections.find(item => item.id === edit.dataset.editSection);
      if (!section) return;
      sectionForm.elements.sectionId.value = section.id;
      sectionForm.elements.pageKey.value = section.pageKey;
      sectionForm.elements.title.value = section.title;
      sectionForm.elements.body.value = section.body;
      sectionForm.elements.published.checked = section.published;
      cancelSectionEdit.hidden = false;
      document.getElementById("section-form-title").textContent = "Edit page section";
      sectionForm.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (remove) {
      remove.disabled = true;
      try {
        await store.deleteSection(remove.dataset.deleteSection);
        await refresh();
        notify("Page section deleted.");
      } catch (error) {
        notify(error.message || "The page section could not be deleted.", true);
      } finally {
        remove.disabled = false;
      }
    }
  });

  document.getElementById("export-data").addEventListener("click", async () => {
    try {
      const data = await store.exportData();
      const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `little-harvard-site-backup-${today}.json`;
      link.click();
      URL.revokeObjectURL(url);
      notify("Public content backup downloaded.");
    } catch (error) {
      notify(error.message || "The backup could not be exported.", true);
    }
  });

  document.getElementById("import-data").addEventListener("change", async event => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      await store.importData(JSON.parse(await file.text()));
      await refresh();
      notify("Public content backup restored.");
    } catch (error) {
      console.error("Could not import school website backup.", error);
      notify(error.message || "The selected backup could not be imported.", true);
    } finally {
      event.target.value = "";
    }
  });

  bootstrap();
})();
