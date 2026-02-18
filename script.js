// 16.1 — Initialize Supabase
const SUPABASE_URL = "https://qgvgaswagloibanqbfbc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BSZwz-29LbC2iAJHpTxpBA_MbJQmQS2";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 16.2 — Fetch all slots and render them
async function loadSlots() {
    const { data, error } = await supabase
        .from("slots")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.error("Error loading slots:", error);
        return;
    }

    renderSlots(data);
}

document.addEventListener("DOMContentLoaded", loadSlots);

// 16.3 — Render the 40 slots into the HTML grid
function renderSlots(slots) {
    const container = document.getElementById("slots-container");
    container.innerHTML = "";

    slots.forEach(slot => {
        const expired = isExpired(slot.claimed_at);

        const div = document.createElement("div");
        div.className = "slot";

        div.innerHTML = `
            <img src="${slot.thumbnail_url || 'placeholder.png'}" class="thumb">

            <h3>Slot #${slot.id}</h3>

            <p><strong>Film:</strong> ${slot.film_name || "—"}</p>
            <p><strong>Genre:</strong> ${slot.genre || "—"}</p>
            <p><strong>City:</strong> ${slot.city || "—"}</p>

            <button onclick="openClaimModal(${slot.id})" ${slot.film_name && !expired ? "disabled" : ""}>
                ${expired ? "Reclaim Slot" : (slot.film_name ? "Claimed" : "Claim Slot")}
            </button>

            <button onclick="openUpdateModal(${slot.id})" ${!slot.film_name ? "disabled" : ""}>
                Update Slot
            </button>

            <button onclick="openFilmUploadModal(${slot.id})" ${!slot.film_name ? "disabled" : ""}>
                Upload Film
            </button>

            <button onclick="openReleaseModal(${slot.id})" ${!slot.film_name ? "disabled" : ""}>
                Release Slot
            </button>

            ${expired ? `<p class="expired">Expired — 7 days passed</p>` : ""}
        `;

        container.appendChild(div);
    });
}

// 16.4 — Check if a slot is expired
function isExpired(claimedAt) {
    if (!claimedAt) return false;

    const claimed = new Date(claimedAt);
    const now = new Date();

    const diff = now - claimed;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    return diff > sevenDays;
}

// 16.5 — Open modal to claim a slot
function openClaimModal(slotId) {
    document.getElementById("claim-slot-id").value = slotId;
    document.getElementById("claim-modal").style.display = "block";
}

// 16.6 — Claim slot and save data
async function claimSlot() {
    const slotId = document.getElementById("claim-slot-id").value;
    const filmName = document.getElementById("claim-film-name").value;
    const genre = document.getElementById("claim-genre").value;
    const city = document.getElementById("claim-city").value;
    const email = document.getElementById("claim-email").value;
    const password = document.getElementById("claim-password").value;
    const thumbnailFile = document.getElementById("claim-thumbnail").files[0];

    // Hash password
    const passwordHash = await hashPassword(password);

    // Upload thumbnail
    let thumbnailUrl = null;
    if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail(slotId, thumbnailFile);
    }

    // Update slot
    const { error } = await supabase
        .from("slots")
        .update({
            film_name: filmName,
            genre: genre,
            city: city,
            email: email,
            password_hash: passwordHash,
            thumbnail_url: thumbnailUrl,
            claimed_at: new Date().toISOString()
        })
        .eq("id", slotId);

    if (error) {
        alert("Error claiming slot.");
        console.error(error);
        return;
    }

    closeModals();
    loadSlots();
}

// 16.7 — Hash password using bcryptjs
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// 16.8 — Verify password by comparing hashes
async function verifyPassword(slotId, inputPassword) {
    const { data } = await supabase
        .from("slots")
        .select("password_hash")
        .eq("id", slotId)
        .single();

    if (!data || !data.password_hash) return false;

    return await bcrypt.compare(inputPassword, data.password_hash);
}

// 16.9 — Upload thumbnail to public bucket
async function uploadThumbnail(slotId, file) {
    const filePath = `${slotId}/${file.name}`;

    const { data, error } = await supabase.storage
        .from("thumbnails")
        .upload(filePath, file, { upsert: true });

    if (error) {
        console.error("Thumbnail upload error:", error);
        return null;
    }

    const { publicURL } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filePath);

    return publicURL;
}

// 16.10 — Open update modal
function openUpdateModal(slotId) {
    document.getElementById("update-slot-id").value = slotId;
    document.getElementById("update-modal").style.display = "block";
}

// 16.10 — Submit update
async function updateSlot() {
    const slotId = document.getElementById("update-slot-id").value;
    const password = document.getElementById("update-password").value;

    const valid = await verifyPassword(slotId, password);
    if (!valid) {
        alert("Incorrect password.");
        return;
    }

    const filmName = document.getElementById("update-film-name").value;
    const genre = document.getElementById("update-genre").value;
    const city = document.getElementById("update-city").value;
    const thumbnailFile = document.getElementById("update-thumbnail").files[0];

    let thumbnailUrl = null;
    if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail(slotId, thumbnailFile);
    }

    const { error } = await supabase
        .from("slots")
        .update({
            film_name: filmName,
            genre: genre,
            city: city,
            thumbnail_url: thumbnailUrl || undefined
        })
        .eq("id", slotId);

    if (error) {
        alert("Error updating slot.");
        return;
    }

    closeModals();
    loadSlots();
}

// 16.11 — Open film upload modal
function openFilmUploadModal(slotId) {
    document.getElementById("film-slot-id").value = slotId;
    document.getElementById("film-modal").style.display = "block";
}

// 16.11 — Upload film
async function uploadFilm() {
    const slotId = document.getElementById("film-slot-id").value;
    const password = document.getElementById("film-password").value;

    const valid = await verifyPassword(slotId, password);
    if (!valid) {
        alert("Incorrect password.");
        return;
    }

    const filmFile = document.getElementById("film-file").files[0];
    const filePath = `${slotId}/${filmFile.name}`;

    const { data, error } = await supabase.storage
        .from("films")
        .upload(filePath, filmFile, { upsert: true });

    if (error) {
        alert("Film upload failed.");
        return;
    }

    const { error: updateError } = await supabase
        .from("slots")
        .update({ film_url: filePath })
        .eq("id", slotId);

    if (updateError) {
        alert("Error saving film reference.");
        return;
    }

    closeModals();
    loadSlots();
}

// 16.12 — Open release modal
function openReleaseModal(slotId) {
    document.getElementById("release-slot-id").value = slotId;
    document.getElementById("release-modal").style.display = "block";
}

// 16.13 — Close all modals
function closeModals() {
    document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
}
