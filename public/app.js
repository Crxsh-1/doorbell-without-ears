const $ = (selector) => document.querySelector(selector);

const eventsList = $("#events-list");
const historyList = $("#history-list");
const statusMessage = $("#status-message");

let preferences = {};
const pendingReplies = new Map();

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function readableDate(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function eventLabel(kind) {
  return ({
    doorbell: "Doorbell",
    motion: "Motion detected",
    knock: "Knock"
  })[kind] || kind || "Visitor event";
}

async function loadEvents() {
  try {
    const data = await api("/api/events");
    const events = Array.isArray(data.events) ? data.events : [];

    if (!events.length) {
      eventsList.innerHTML = `
        <div class="panel">
          <h3>No visitor events yet</h3>
          <p class="muted">Use “Simulate visitor” to create a sample event and test the workflow.</p>
        </div>`;
      return;
    }

    eventsList.innerHTML = events.map((event) => {
      const id = escapeHtml(event.id);
      const status = escapeHtml(event.status || "new");
      const description = escapeHtml(event.visitorHint || "No additional details");
      const created = escapeHtml(readableDate(event.timestamp));
      const pending = pendingReplies.get(event.id);
      const isDismissed = event.status === "dismissed";

      return `
        <article class="panel event-card">
          <div class="event-top">
            <div class="event-type">${escapeHtml(eventLabel(event.kind))}</div>
            <span class="pill">${status}</span>
          </div>
          <p class="event-description">${description}</p>
          <p class="event-meta">Received: ${created}</p>
          <p class="event-meta">Event ID: ${id}</p>
          <div class="event-actions">
            <button class="button primary" type="button"
              data-action="propose" data-id="${id}" ${isDismissed ? "disabled" : ""}>
              Suggest a reply
            </button>
            <button class="button secondary" type="button"
              data-action="dismiss" data-id="${id}" ${isDismissed ? "disabled" : ""}>
              ${isDismissed ? "Dismissed" : "Dismiss event"}
            </button>
          </div>
          ${pending && !isDismissed ? `
            <div class="reply-box">
              <h3>Suggested reply</h3>
              <blockquote>${escapeHtml(pending.text)}</blockquote>
              <p class="basis">Why this was suggested: ${escapeHtml((pending.basis || []).join("; "))}</p>
              <p><strong>Nothing is sent unless you confirm.</strong></p>
              <div class="event-actions">
                <button class="button primary" type="button"
                  data-action="confirm" data-id="${id}">Confirm simulated reply</button>
                <button class="button secondary" type="button"
                  data-action="reject" data-id="${id}">Reject reply</button>
              </div>
            </div>` : ""}
        </article>`;
    }).join("");
  } catch (error) {
    eventsList.innerHTML = `
      <div class="panel">
        <h3>Couldn't load visitor events</h3>
        <p>${escapeHtml(error.message)}</p>
        <p class="muted">Check that the local server is running, then refresh.</p>
      </div>`;
  }
}

async function loadPreferences() {
  try {
    preferences = await api("/api/preferences");

    $("#text-size").value = ["medium", "large", "xlarge"].includes(preferences.textSize)
      ? preferences.textSize : "large";
    $("#high-contrast").checked = Boolean(preferences.highContrast);
    $("#flash-alerts").checked = Boolean(preferences.flashAlerts);
    $("#delivery-instruction").value = preferences.deliveryInstruction || "";
    $("#unknown-instruction").value = preferences.unknownVisitorInstruction || "";

    applyAccessibility();
  } catch (error) {
    showStatus(`Couldn't load preferences: ${error.message}`, true);
  }
}

function applyAccessibility() {
  document.body.classList.toggle("text-large", $("#text-size").value === "large");
  document.body.classList.toggle("text-xlarge", $("#text-size").value === "xlarge");
  document.body.classList.toggle("high-contrast", $("#high-contrast").checked);
  document.body.classList.toggle("flash-alerts", $("#flash-alerts").checked);
}

async function savePreferences() {
  const values = {
    textSize: $("#text-size").value,
    highContrast: $("#high-contrast").checked,
    flashAlerts: $("#flash-alerts").checked,
    deliveryInstruction: $("#delivery-instruction").value.trim(),
    unknownVisitorInstruction: $("#unknown-instruction").value.trim()
  };

  try {
    const result = await api("/api/preferences", {
      method: "PATCH",
      body: JSON.stringify(values)
    });

    preferences = result.preferences || { ...preferences, ...values };
    await loadPreferences();
    showStatus("Preferences saved successfully.");
  } catch (error) {
    showStatus(`Couldn't save preferences: ${error.message}`, true);
  }
}

async function loadHistory() {
  historyList.textContent = "Loading action history…";

  try {
    const data = await api("/api/history");
    const records = Array.isArray(data) ? data : data.records || data.history || [];

    if (!records.length) {
      historyList.innerHTML = '<p class="muted">No recorded actions yet.</p>';
      return;
    }

    historyList.innerHTML = records.map((record) => `
      <div class="history-entry">
        <strong>${escapeHtml(record.action || record.type || "Recorded action")}</strong>
        <p class="muted">${escapeHtml(record.message || record.text || record.status || "")}</p>
        <p class="event-meta">${escapeHtml(readableDate(record.timestamp || record.createdAt))}</p>
      </div>`).join("");
  } catch (error) {
    historyList.textContent = `Couldn't load history: ${error.message}`;
  }
}

$("#simulate-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const kind = $("#event-kind").value;

  try {
    await api("/api/events/simulate", {
      method: "POST",
      body: JSON.stringify({
        kind,
        visitorHint: `Simulated ${kind} event`
      })
    });

    showStatus("Simulated visitor event created.");
    await loadEvents();
  } catch (error) {
    showStatus(`Couldn't simulate event: ${error.message}`, true);
  }
});

eventsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const eventId = button.dataset.id;
  if (!eventId) return;

  button.disabled = true;

  try {
    if (action === "propose") {
      const reply = await api(`/api/events/${encodeURIComponent(eventId)}/propose`, {
        method: "POST",
        body: JSON.stringify({})
      });

      pendingReplies.set(eventId, reply);
      showStatus("Reply suggestion ready. Review it before confirming.");
      await loadEvents();
    } else if (action === "confirm" || action === "reject") {
      const reply = pendingReplies.get(eventId);
      if (!reply) {
        throw new Error("No pending reply found. Please request a new suggestion.");
      }

      const confirmed = action === "confirm";
      const result = await api(`/api/events/${encodeURIComponent(eventId)}/confirm`, {
        method: "POST",
        body: JSON.stringify({ replyId: reply.id, confirmed })
      });

      pendingReplies.delete(eventId);
      showStatus(result.message || (confirmed
        ? "Simulated reply confirmed."
        : "Reply rejected."));
      await Promise.all([loadEvents(), loadHistory()]);
    } else if (action === "dismiss") {
      await api(`/api/events/${encodeURIComponent(eventId)}/dismiss`, {
        method: "POST",
        body: JSON.stringify({})
      });

      pendingReplies.delete(eventId);
      showStatus("Visitor event dismissed.");
      await Promise.all([loadEvents(), loadHistory()]);
    }
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("#refresh-button").addEventListener("click", loadEvents);
$("#history-refresh").addEventListener("click", loadHistory);
$("#save-preferences").addEventListener("click", savePreferences);

["#text-size", "#high-contrast", "#flash-alerts"].forEach((selector) => {
  $(selector).addEventListener("change", applyAccessibility);
});

async function init() {
  await Promise.all([loadEvents(), loadPreferences(), loadHistory()]);
}

init();