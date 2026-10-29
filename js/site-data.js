(function () {
  const config = window.SUPABASE_CONFIG || {};
  const contentTables = ["news", "events", "notices"];
  const defaults = {
    settings: {
      schoolName: "The Little Harvard Academy",
      motto: "Knowledge · Discipline · Excellence",
      headline: "A bright beginning. A brilliant future.",
      introduction: "A caring learning community where every child is known, challenged and encouraged to thrive.",
      phone: "+254 742 676 542",
      email: "ochiengvicky21@gmail.com",
      address: "P.O. Box 40300, Kenya",
      admissionsOpen: true
    },
    news: [
      { id: "welcome-2026", title: "Welcome to a new school year", body: "We look forward to welcoming our learners back for a year of discovery, friendship and achievement.", date: "2026-10-01", published: true },
      { id: "learning-together", title: "Learning through curiosity", body: "Our classrooms bring questions to life through hands-on projects, teamwork and thoughtful teaching.", date: "2026-09-10", published: true },
      { id: "community-day", title: "School community day", body: "Thank you to all the families who joined us to celebrate the creativity and spirit of our learners.", date: "2026-08-20", published: true }
    ],
    events: [
      { id: "open-day-2027", title: "Open Day & Campus Tours", body: "Meet our teachers, explore the campus and learn about admissions.", date: "2027-01-16", published: true },
      { id: "parent-meeting-2027", title: "Parent–Teacher Meetings", body: "A chance to discuss learner progress and goals for the new term.", date: "2027-02-05", published: true },
      { id: "sports-day-2027", title: "Annual Sports Day", body: "A day of teamwork, friendly competition and family fun.", date: "2027-03-19", published: true }
    ],
    notices: [
      { id: "admissions-2027", title: "Applications are open", body: "Enquire now about available places for the 2027 school year.", date: "2026-10-01", published: true },
      { id: "term-calendar", title: "Term dates and calendar", body: "Contact the school office to request the latest term calendar.", date: "2026-10-01", published: true }
    ],
    submissions: [],
    assets: [],
    sections: [],
    cmsReady: false
  };
  const roles = {
    admin: ["overview", "news", "events", "notices", "site", "inbox", "settings"],
    editor: ["overview", "news", "events", "notices", "site"],
    admissions: ["overview", "inbox"],
    communications: ["overview", "news", "events", "notices", "inbox"]
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  let client;
  let currentRole = null;
  let currentUser = null;
  let state = clone(defaults);

  const ready = (async () => {
    if (!config.url || !config.anonKey) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load the Supabase client library."));
      document.head.appendChild(script);
    });
    if (!window.supabase?.createClient) throw new Error("The Supabase client library did not initialize.");
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
  })();

  function requireConfigured() {
    if (!config.url || !config.anonKey) {
      throw new Error("Supabase is not configured. Add the project URL and publishable anon key to js/supabase-config.js.");
    }
    if (!client) throw new Error("The Supabase connection is not available.");
    return client;
  }

  function throwIfError(result) {
    if (result.error) throw new Error(result.error.message || "The Supabase request failed.");
    return result.data;
  }

  async function invokeFunction(db, name, body) {
    const result = await db.functions.invoke(name, { body });
    if (result.error) {
      let detail;
      try {
        detail = await result.error.context?.json();
      } catch {
        detail = null;
      }
      throw new Error(detail?.error || result.error.message || "The secure school service could not complete this request.");
    }
    return result.data;
  }

  function toSettings(row) {
    if (!row) return { ...defaults.settings };
    return {
      schoolName: row.school_name,
      motto: row.motto,
      headline: row.headline,
      introduction: row.introduction,
      phone: row.phone,
      email: row.email,
      address: row.address,
      admissionsOpen: row.admissions_open
    };
  }

  function toContent(row) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      date: row.publish_date,
      published: row.published
    };
  }

  function toSubmission(row) {
    return {
      id: row.id,
      type: row.kind,
      name: row.name,
      parentName: row.name,
      email: row.email,
      phone: row.phone,
      studentName: row.student_name,
      grade: row.grade,
      department: row.department,
      subject: row.subject,
      message: row.message,
      additionalInfo: row.message,
      visitDate: row.preferred_visit_date,
      status: row.status,
      reply: row.reply,
      receivedAt: row.created_at,
      repliedAt: row.replied_at
    };
  }

  function toAsset(db, row) {
    return {
      id: row.id,
      kind: row.kind,
      pageKey: row.page_key,
      title: row.title,
      description: row.description,
      url: db.storage.from("public-site").getPublicUrl(row.object_path).data.publicUrl,
      objectPath: row.object_path,
      fileName: row.file_name,
      contentType: row.content_type,
      fileSize: row.file_size,
      personName: row.person_name,
      position: row.position,
      department: row.department,
      email: row.email,
      phone: row.phone,
      sortOrder: row.sort_order,
      published: row.published
    };
  }

  function toSection(row) {
    return {
      id: row.id,
      pageKey: row.page_key,
      title: row.title,
      body: row.body,
      sortOrder: row.sort_order,
      published: row.published
    };
  }

  async function loadCmsData(db) {
    const [assetResult, sectionResult] = await Promise.all([
      db.from("site_assets").select("*").order("sort_order").order("created_at", { ascending: false }),
      db.from("site_sections").select("*").order("page_key").order("sort_order").order("created_at")
    ]);
    let cmsReady = true;
    const readRows = (result, table) => {
      if (!result.error) return result.data;
      if (["PGRST205", "42P01"].includes(result.error.code)) {
        cmsReady = false;
        console.error(`The ${table} CMS table is not installed. Run supabase/cms.sql in the Supabase SQL Editor.`, result.error.message);
        return [];
      }
      return throwIfError(result);
    };
    return {
      assets: readRows(assetResult, "site_assets").map(row => toAsset(db, row)),
      sections: readRows(sectionResult, "site_sections").map(toSection),
      cmsReady
    };
  }

  async function loadContent(db, includeDrafts) {
    let query = db.from("site_content").select("*");
    if (!includeDrafts) query = query.eq("published", true);
    const rows = throwIfError(await query.order("publish_date", { ascending: false }));
    return {
      news: rows.filter(row => row.kind === "news").map(toContent),
      events: rows.filter(row => row.kind === "events").map(toContent),
      notices: rows.filter(row => row.kind === "notices").map(toContent)
    };
  }

  async function loadPublic() {
    await ready;
    if (!config.url || !config.anonKey) {
      state = clone(defaults);
      return clone(state);
    }
    const db = requireConfigured();
    const [settingsResult, content, cms] = await Promise.all([
      db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      loadContent(db, false),
      loadCmsData(db)
    ]);
    const settings = throwIfError(settingsResult);
    state = { ...clone(defaults), settings: toSettings(settings), ...content, submissions: [], ...cms };
    return clone(state);
  }

  async function getSession() {
    await ready;
    if (!config.url || !config.anonKey) return { user: null, role: null };
    const db = requireConfigured();
    const sessionResult = throwIfError(await db.auth.getSession());
    const user = sessionResult.session?.user || null;
    currentUser = user;
    currentRole = null;
    if (!user) return { user: null, role: null };
    const roleResult = await db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    throwIfError(roleResult);
    currentRole = roleResult.data?.role || null;
    return { user, role: currentRole };
  }

  async function loadAdmin() {
    const db = requireConfigured();
    const session = await getSession();
    if (!session.user) throw new Error("Sign in to access the school office.");
    if (!session.role || !roles[session.role]) {
      throw new Error("Your account does not have a school staff role. Ask an administrator to grant access.");
    }
    const [settingsResult, content, submissionsResult, cms] = await Promise.all([
      db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      loadContent(db, true),
      db.from("public_submissions").select("*").order("created_at", { ascending: false }),
      loadCmsData(db)
    ]);
    const settings = throwIfError(settingsResult);
    const submissions = throwIfError(submissionsResult).map(toSubmission);
    state = {
      ...clone(defaults),
      settings: toSettings(settings),
      ...content,
      submissions,
      ...cms
    };
    return { data: clone(state), user: currentUser, role: currentRole };
  }

  function allowedPanels(role) {
    return roles[role] ? [...roles[role]] : [];
  }

  async function signIn(email, password) {
    const db = requireConfigured();
    const result = throwIfError(await db.auth.signInWithPassword({ email, password }));
    const session = await getSession();
    if (!session.role || !roles[session.role]) {
      await db.auth.signOut();
      currentUser = null;
      currentRole = null;
      throw new Error("This account does not have an assigned school staff role.");
    }
    return { ...result, role: session.role };
  }

  async function signOut() {
    const db = requireConfigured();
    throwIfError(await db.auth.signOut());
    currentUser = null;
    currentRole = null;
  }

  async function upsertContent(kind, item) {
    const db = requireConfigured();
    if (!contentTables.includes(kind)) throw new Error("Unknown school content category.");
    const result = throwIfError(await db.from("site_content").upsert({
      ...(item.id ? { id: item.id } : {}),
      kind,
      title: item.title,
      body: item.body,
      publish_date: item.date,
      published: item.published
    }).select("*").single());
    return toContent(result);
  }

  async function deleteContent(id) {
    const db = requireConfigured();
    throwIfError(await db.from("site_content").delete().eq("id", id));
  }

  async function updateSettings(settings) {
    const db = requireConfigured();
    const row = throwIfError(await db.from("site_settings").update({
      school_name: settings.schoolName,
      motto: settings.motto,
      headline: settings.headline,
      introduction: settings.introduction,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      admissions_open: settings.admissionsOpen
    }).eq("id", 1).select("*").single());
    state.settings = toSettings(row);
  }

  async function saveAsset({ id, kind, pageKey, file, title, description, personName, position, department, email, phone }) {
    const db = requireConfigured();
    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp"
    ]);
    if (!["document", "gallery", "staff"].includes(kind)) throw new Error("Choose a valid upload category.");
    if (!(file instanceof File) || !allowedTypes.has(file.type)) {
      throw new Error("Upload a PDF, Word document, JPG, PNG or WebP file.");
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Uploads must be smaller than 10 MB.");
    if (kind === "document" && !file.type.startsWith("application/")) throw new Error("Choose a PDF or Word document for downloads.");
    if (kind !== "document" && !file.type.startsWith("image/")) throw new Error("Choose an image for a gallery photo or staff profile.");
    if (kind === "staff" && (!personName.trim() || !position.trim())) {
      throw new Error("Enter the staff member's name and position.");
    }

    const safeName = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "upload";
    const objectPath = `${kind}/${crypto.randomUUID()}-${safeName}`;
    const bucket = db.storage.from("public-site");
    const uploaded = await bucket.upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });
    throwIfError(uploaded);

    const record = {
      kind,
      page_key: kind === "gallery" ? pageKey : null,
      title: title.trim(),
      description: description.trim(),
      object_path: objectPath,
      file_name: file.name.slice(0, 255),
      content_type: file.type,
      file_size: file.size,
      person_name: kind === "staff" ? personName.trim() : null,
      position: kind === "staff" ? position.trim() : null,
      department: kind === "staff" ? department.trim() || null : null,
      email: kind === "staff" ? email.trim() || null : null,
      phone: kind === "staff" ? phone.trim() || null : null,
      published: true
    };

    let result;
    try {
      result = id
        ? await db.from("site_assets").update(record).eq("id", id).select("*").single()
        : await db.from("site_assets").insert(record).select("*").single();
      throwIfError(result);
    } catch (error) {
      const cleanup = await bucket.remove([objectPath]);
      if (cleanup.error) console.error("Could not remove uploaded file after its record failed to save.", cleanup.error);
      throw error;
    }

    const previousPath = id ? state.assets.find(asset => asset.id === id)?.objectPath : null;
    if (previousPath && previousPath !== objectPath) {
      const cleanup = await bucket.remove([previousPath]);
      if (cleanup.error) console.error("The asset was updated, but its previous file could not be removed.", cleanup.error);
    }
    return toAsset(db, result.data);
  }

  async function deleteAsset(id) {
    const db = requireConfigured();
    const asset = state.assets.find(item => item.id === id);
    if (!asset) throw new Error("This upload could not be found. Refresh and try again.");
    throwIfError(await db.from("site_assets").delete().eq("id", id));
    const removal = await db.storage.from("public-site").remove([asset.objectPath]);
    if (removal.error) {
      console.error("The upload record was removed, but the file cleanup failed.", removal.error);
      throw new Error("The upload was removed from the website, but its stored file could not be cleaned up. Contact the site administrator.");
    }
  }

  async function saveSection({ id, pageKey, title, body, published }) {
    const db = requireConfigured();
    if (!/^[a-z-]+$/.test(pageKey)) throw new Error("Choose a valid website page.");
    const record = {
      page_key: pageKey,
      title: title.trim(),
      body: body.trim(),
      published: Boolean(published)
    };
    const result = id
      ? await db.from("site_sections").update(record).eq("id", id).select("*").single()
      : await db.from("site_sections").insert(record).select("*").single();
    return toSection(throwIfError(result));
  }

  async function deleteSection(id) {
    const db = requireConfigured();
    throwIfError(await db.from("site_sections").delete().eq("id", id));
  }

  async function submitSubmission(formType, values, captchaToken) {
    const db = requireConfigured();
    const kinds = {
      admission: "admission",
      visit: "visit",
      newsletter: "newsletter",
      contact: "contact"
    };
    const kind = kinds[formType];
    if (!kind) throw new Error("Choose a valid enquiry type.");
    if (!captchaToken || captchaToken.length > 2048) {
      throw new Error("Complete the security check before sending your enquiry.");
    }
    const request = await invokeFunction(db, "submit-public-message", {
      kind,
      name: values.parentName || values.name || "",
      email: values.email || "",
      phone: values.phone || "",
      studentName: values.studentName || "",
      grade: values.grade || "",
      department: values.department || "",
      subject: values.subject || "",
      message: values.message || values.additionalInfo || "",
      preferredVisitDate: values.visitDate || "",
      website: values.website || "",
      captchaToken
    });
    if (!request?.success) throw new Error("The message could not be submitted. Please try again or contact the school directly.");
    return true;
  }

  async function updateSubmissionStatus(id, status) {
    const db = requireConfigured();
    throwIfError(await db.from("public_submissions").update({ status }).eq("id", id));
  }

  async function deleteSubmission(id) {
    const db = requireConfigured();
    throwIfError(await db.from("public_submissions").delete().eq("id", id));
  }

  async function sendReply(id, message) {
    const db = requireConfigured();
    const result = await invokeFunction(db, "send-public-reply", { submissionId: id, message });
    if (!result?.success) throw new Error("The reply could not be sent.");
  }

  async function exportData() {
    const { data } = await loadAdmin();
    return { version: 1, exportedAt: new Date().toISOString(), settings: data.settings, news: data.news, events: data.events, notices: data.notices };
  }

  async function importData(imported) {
    if (!imported || typeof imported !== "object"
      || !imported.settings || !["news", "events", "notices"].every(key => Array.isArray(imported[key]))) {
      throw new Error("The selected backup is missing settings or content.");
    }
    const session = await getSession();
    if (session.role !== "admin") throw new Error("Only a school administrator can restore a backup.");
    const db = requireConfigured();
    const settings = imported.settings;
    const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    throwIfError(await db.from("site_settings").update({
      school_name: settings.schoolName,
      motto: settings.motto,
      headline: settings.headline,
      introduction: settings.introduction,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      admissions_open: Boolean(settings.admissionsOpen)
    }).eq("id", 1));
    for (const kind of contentTables) {
      for (const item of imported[kind]) {
        await upsertContent(kind, { ...item, id: validUuid.test(item.id || "") ? item.id : undefined });
      }
    }
    await loadAdmin();
  }

  function subscribe(onChange, onError) {
    const db = requireConfigured();
    const channel = db.channel("school-site-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_assets" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_sections" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "public_submissions" }, onChange)
      .subscribe(status => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onError(new Error(`Live updates are ${status.toLowerCase().replace("_", " ")}.`));
      });
    return () => { db.removeChannel(channel); };
  }

  window.SchoolSiteData = {
    ready,
    isConfigured: () => Boolean(config.url && config.anonKey),
    configurationError: () => !config.url || !config.anonKey
      ? "Supabase is not configured. Add the project URL and publishable anon key to js/supabase-config.js."
      : "",
    turnstileSiteKey: config.turnstileSiteKey || "",
    get: () => clone(state),
    loadPublic,
    getSession,
    loadAdmin,
    allowedPanels,
    signIn,
    signOut,
    upsertContent,
    deleteContent,
    updateSettings,
    saveAsset,
    deleteAsset,
    saveSection,
    deleteSection,
    submitSubmission,
    updateSubmissionStatus,
    deleteSubmission,
    sendReply,
    exportData,
    importData,
    subscribe
  };
})();
