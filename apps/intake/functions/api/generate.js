/**
 * GENERATE.JS - The Elite Factory Middleware
 * Updated with Hydration + Layout Strategy + GitHub Commit Logic
 */
import { Octokit } from "@octokit/rest"; // Assuming you use Octokit

export async function generateClientSite(aiResponse, clientSlug) {
  // 1. THE HYDRATION LAYER (The QC Filter)
  const hydratedData = hydrateProjectData(aiResponse, clientSlug);

  // 2. GITHUB COMMIT LOGIC (Restore your specific implementation here)
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const owner = "YourOrg";
  const repo = "agency-vibe-template";
  const filePath = `clients/${clientSlug}/business.base.json`;

  try {
    const content = Buffer.from(JSON.stringify(hydratedData, null, 2)).toString('base64');
    
    // Check if file exists to get SHA for updates
    let sha;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
      sha = data.sha;
    } catch (e) { /* New File */ }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Factory: Commit hydrated data for ${clientSlug}`,
      content,
      sha
    });

    console.log(`✅ Factory: Committed hydrated data for ${clientSlug}`);
    return hydratedData;
  } catch (error) {
    console.error("❌ GitHub Commit Failed:", error);
    throw error;
  }
}

/**
 * Ensures no section feels "thin" or empty.
 */
function hydrateProjectData(raw, slug) {
  const data = JSON.parse(JSON.stringify(raw)); 

  // A. SLUG & BRAND CONSISTENCY
  data.brand = data.brand || {};
  data.brand.slug = (data.brand.slug || slug).toLowerCase().replace(/[^a-z0-9]/g, '-');

  // B. NAVIGATION & CTA HYDRATION
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

  // C. INDUSTRY-AWARE LAYOUT LOGIC
  const industry = (data.intelligence?.industry || "").toLowerCase();
  const isLuxury = industry.includes("watch") || industry.includes("luxury") || industry.includes("jewelry");
  const isEvent = data.strategy?.show_events || industry.includes("entertainment") || industry.includes("theatre");

  if (data.strategy?.show_gallery) {
    data.gallery = data.gallery || { enabled: true };
    
    // Auto-assign layout if AI didn't choose
    if (!data.gallery.computed_layout) {
      if (isLuxury) data.gallery.computed_layout = "bento";
      else if (isEvent) data.gallery.computed_layout = "masonry";
      else data.gallery.computed_layout = "grid";
    }

    const count = data.gallery.computed_count || 6;
    if (!data.gallery.items || data.gallery.items.length === 0) {
      data.gallery.items = Array.from({ length: count }).map((_, i) => ({
        title: `Project ${i + 1}`
      }));
    }
  }

  // D. THE "ANTI-THIN" ABOUT SECTION
  if (data.strategy?.show_about) {
    data.about = data.about || {};
    if (!data.about.story_text || data.about.story_text.length < 20) {
      data.about.story_text = isLuxury 
        ? `${data.brand.name} preserves the heritage of fine craftsmanship, combining traditional techniques with modern precision.`
        : `${data.brand.name} is dedicated to delivering excellence through passion and expertise.`;
    }
    data.about.founder_note = data.about.founder_note || "Precision in every detail.";
    data.about.years_experience = data.about.years_experience || "15+";
  }

  return data;
}