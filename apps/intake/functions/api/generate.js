/**
 * GENERATE.JS - The Elite Factory Middleware
 * 1. Takes AI output
 * 2. Hydrates missing keys (Anti-Thin Logic)
 * 3. Ghostwrites professional copy where client was vague
 */

export async function generateClientSite(aiResponse, clientSlug) {
  // --- 1. THE HYDRATION LAYER ---
  const hydratedData = hydrateProjectData(aiResponse, clientSlug);

  // --- 2. GITHUB COMMIT LOGIC (Placeholder for your current push logic) ---
  console.log(`🚀 Factory: Preparing to commit hydrated data for ${clientSlug}`);
  
  // Here you would call your existing GitHub API logic to save:
  // clients/${clientSlug}/business.base.json
  
  return hydratedData;
}

/**
 * Ensures no section feels "thin" or empty.
 * Injects mandatory arrays and ghostwrites mission statements.
 */
function hydrateProjectData(raw, slug) {
  const data = JSON.parse(JSON.stringify(raw)); // Deep clone

  // A. THE SLUG GUARD
  data.brand = data.brand || {};
  data.brand.slug = (data.brand.slug || slug).toLowerCase().replace(/[^a-z0-9]/g, '-');

  // B. NAVIGATION & CTA HYDRATION
  // Prevents the "Empty Navbar" issue seen in previous builds
  if (!data.settings) data.settings = {};
  if (!data.settings.menu || data.settings.menu.length === 0) {
    data.settings.menu = [
      { label: "Home", path: "#home" },
      { label: "About", path: "#about" },
      { label: "Gallery", path: "#gallery" },
      { label: "Contact", path: "#contact" }
    ];
  }
  data.settings.cta_text = data.settings.cta_text || "Get Started";
  data.settings.cta_link = data.settings.cta_link || "#contact";
  
  // Ensure a Vibe is always officially part of the engine
  const validVibes = ["Legacy Professional", "Solar Flare", "Midnight Tech", "Modern Minimal"];
  if (!validVibes.includes(data.settings.vibe)) {
    data.settings.vibe = "Legacy Professional"; 
  }

  // C. THE "ANTI-THIN" ABOUT SECTION
  if (data.strategy?.show_about) {
    data.about = data.about || {};
    data.intelligence = data.intelligence || {};

    // Ghostwrite the Story if it's too short or missing
    if (!data.about.story_text || data.about.story_text.length < 20) {
      data.about.story_text = `${data.brand.name} was founded on a commitment to uncompromising quality. We specialize in merging traditional techniques with modern precision to deliver results that stand the test of time.`;
    }

    // Ghostwrite a high-impact quote
    data.about.founder_note = data.about.founder_note || "Excellence is not an act, but a habit.";
    data.about.years_experience = data.about.years_experience || "15+";
    data.intelligence.industry = data.intelligence.industry || "Premium Services";
  }

  // D. GALLERY SKELETON (Resilient Handshake)
  // Ensures the Gallery component has enough "hooks" to render the images 
  // currently being downloaded by your Unsplash fetcher.
  if (data.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true };
    const count = data.gallery.computed_count || 6;
    
    if (!data.gallery.items || data.gallery.items.length === 0) {
      data.gallery.items = Array.from({ length: count }).map((_, i) => ({
        title: `Project ${i + 1}`,
        description: "Exhibition of our master-level craftsmanship."
      }));
    }
  }

  // E. CONTACT HYDRATION
  // Ensures the Footer and Contact sections don't show "N/A"
  data.brand.email = (data.brand.email && data.brand.email !== 'n/a') ? data.brand.email : `hello@${data.brand.slug}.com`;
  data.brand.phone = (data.brand.phone && data.brand.phone !== 'n/a') ? data.brand.phone : "Contact for Appointment";

  return data;
}