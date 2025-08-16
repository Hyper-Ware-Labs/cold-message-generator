// Content script to extract LinkedIn profile information
(function () {
  "use strict";

  function extractProfileData() {
    const profileData = {};

    try {
      // Extract name with multiple fallback selectors
      const nameSelectors = [
        "h1.text-heading-xlarge",
        ".pv-text-details__left-panel h1",
        "h1[data-generated-suggestion-target]",
        ".pv-top-card .pv-top-card__list-item h1",
        ".ph5 h1",
        "main h1",
        ".pv-top-card--photo h1",
        ".pv-top-card__information h1",
        '[data-view-name="profile-card"] h1',
      ];

      let nameElement = null;
      for (const selector of nameSelectors) {
        nameElement = document.querySelector(selector);
        if (nameElement && nameElement.textContent.trim()) break;
      }
      profileData.name = nameElement?.textContent?.trim() || "Professional";

      // Extract headline/title with more selectors
      const headlineSelectors = [
        ".text-body-medium.break-words",
        ".pv-text-details__left-panel .text-body-medium",
        ".pv-top-card--list-bullet .pv-entity__secondary-title",
        ".pv-top-card__headline .break-words",
        ".pv-top-card .pv-top-card__list-item:not(:first-child)",
        ".ph5 .text-body-medium",
        '[data-view-name="profile-card"] .text-body-medium',
      ];

      let headlineElement = null;
      for (const selector of headlineSelectors) {
        headlineElement = document.querySelector(selector);
        if (headlineElement && headlineElement.textContent.trim()) break;
      }
      profileData.headline = headlineElement?.textContent?.trim() || "";

      // Extract current company with improved logic
      let currentCompany = "";

      // Try multiple approaches for experience section
      const experienceSelectors = [
        "#experience",
        '[data-section="experience"]',
        '[id*="experience"]',
        'section[data-view-name*="experience"]',
      ];

      let experienceSection = null;
      for (const selector of experienceSelectors) {
        experienceSection = document.querySelector(selector);
        if (experienceSection) break;
      }

      if (experienceSection) {
        // Look for the first job entry
        const jobSelectors = [
          ".pvs-entity",
          ".pv-entity",
          ".pv-profile-section__card-item",
          ".experience-item",
        ];

        let firstJob = null;
        for (const selector of jobSelectors) {
          const parentSection =
            experienceSection.closest("section") ||
            experienceSection.parentElement;
          firstJob = parentSection?.querySelector(selector);
          if (firstJob) break;
        }

        if (firstJob) {
          // Try multiple selectors for company name
          const companySelectors = [
            ".pv-entity__secondary-title",
            'span[aria-hidden="true"]',
            ".t-14.t-black--light span",
            ".pvs-entity__caption-wrapper",
            ".pv-entity__company-summary-info span",
            ".t-14 span:not(.visually-hidden)",
          ];

          for (const selector of companySelectors) {
            const companyElement = firstJob.querySelector(selector);
            if (companyElement && companyElement.textContent.trim()) {
              currentCompany = companyElement.textContent.trim();
              break;
            }
          }
        }
      }

      // Enhanced fallback: extract company from headline
      if (!currentCompany && profileData.headline) {
        // Try different patterns - updated for the format "GenAI @Meesho"
        const patterns = [
          / at (.+?)(\s*\|\||\s*\||$)/i,
          / @ ?(.+?)(\s*\|\||\s*\||$)/i,
          /@(.+?)(\s*\|\||\s*\||$)/i,
          /\bat\s+(.+?)(\s*\|\||\s*\||$)/i,
          /\b@\s*(.+?)(\s*\|\||\s*\||$)/i,
        ];

        for (const pattern of patterns) {
          const match = profileData.headline.match(pattern);
          if (match) {
            currentCompany = match[1].trim();
            // Clean up common prefixes/suffixes
            currentCompany = currentCompany
              .replace(
                /^(GenAI|AI|ML|Data|Engineer|Developer|Manager|Lead)\s+/i,
                ""
              )
              .trim();
            break;
          }
        }
      }

      profileData.company = currentCompany;

      // Extract location with more selectors
      const locationSelectors = [
        ".text-body-small.inline.t-black--light.break-words",
        ".pv-text-details__left-panel .text-body-small",
        ".pv-top-card--list-bullet .pv-top-card__list-item",
        ".pv-top-card__location",
        ".ph5 .text-body-small",
        '[data-view-name="profile-card"] .text-body-small',
      ];

      let locationElement = null;
      for (const selector of locationSelectors) {
        locationElement = document.querySelector(selector);
        if (locationElement && locationElement.textContent.trim()) {
          // Make sure it's actually location (not connections count, etc.)
          const text = locationElement.textContent.trim();
          if (!text.includes("connection") && !text.includes("follower")) {
            break;
          }
        }
        locationElement = null;
      }
      profileData.location = locationElement?.textContent?.trim() || "";

      // Extract about section with better selectors
      const aboutSelectors = [
        "#about",
        '[data-section="summary"]',
        '[data-view-name*="about"]',
        '[id*="about"]',
      ];

      let aboutSection = null;
      for (const selector of aboutSelectors) {
        aboutSection = document.querySelector(selector);
        if (aboutSection) break;
      }

      let aboutText = "";
      if (aboutSection) {
        const aboutContentSelectors = [
          ".pv-shared-text-with-see-more .inline-show-more-text",
          ".pv-oc .pv-about-section .pv-about__summary-text",
          ".inline-show-more-text__text",
          ".pvs-header__optional-link + div",
          ".pv-about__text",
          '.full-width span[aria-hidden="true"]',
        ];

        const parentSection =
          aboutSection.closest("section") || aboutSection.parentElement;
        for (const selector of aboutContentSelectors) {
          const aboutContent = parentSection?.querySelector(selector);
          if (aboutContent && aboutContent.textContent.trim()) {
            aboutText = aboutContent.textContent.trim();
            break;
          }
        }
      }

      profileData.about = aboutText;

      // Extract skills with improved selectors
      const skillsSelectors = [
        "#skills",
        '[data-section="skills"]',
        '[data-view-name*="skills"]',
        '[id*="skills"]',
      ];

      let skillsSection = null;
      for (const selector of skillsSelectors) {
        skillsSection = document.querySelector(selector);
        if (skillsSection) break;
      }

      const skills = [];
      if (skillsSection) {
        // Find the parent section that contains the skills
        const parentSection =
          skillsSection.closest("section") ||
          skillsSection.parentElement?.closest("section") ||
          skillsSection.parentElement;

        if (parentSection) {
          // Try multiple selectors for skill items
          const skillElementSelectors = [
            ".pvs-entity__path-node",
            ".pv-skill-category-entity__name span",
            '.pv-skill-entity span[aria-hidden="true"]',
            '.skill-category-entity span[aria-hidden="true"]',
            '.pv-skill-categories-section span[aria-hidden="true"]',
            ".pvs-entity .mr1.t-bold span",
            ".pvs-entity .visually-hidden + span",
            'a[data-field="skill_page_skill_topic"] span',
          ];

          for (const selector of skillElementSelectors) {
            const skillElements = parentSection.querySelectorAll(selector);

            for (const element of skillElements) {
              const skillText = element?.textContent?.trim();
              if (
                skillText &&
                skillText.length > 1 &&
                skillText.length < 50 && // Reasonable skill name length
                !skills.includes(skillText) &&
                !skillText.includes("endorsement") &&
                !skillText.includes("Show all") &&
                !skillText.match(/^\d+$/) // Not just numbers
              ) {
                skills.push(skillText);
              }
            }

            if (skills.length > 0) break;
          }

          // If still no skills found, try a more general approach
          if (skills.length === 0) {
            const allSpans = parentSection.querySelectorAll("span");
            for (const span of allSpans) {
              const text = span.textContent?.trim();
              if (
                text &&
                text.length > 2 &&
                text.length < 30 &&
                !text.includes("skill") &&
                !text.includes("endorsement") &&
                !text.includes("Show") &&
                !text.match(/^\d+/) &&
                !skills.includes(text) &&
                span.closest('a[data-field="skill_page_skill_topic"]')
              ) {
                skills.push(text);
                if (skills.length >= 8) break;
              }
            }
          }
        }
      }

      profileData.skills = skills.slice(0, 8); // Limit to 8 skills

      // Additional validation and cleanup
      if (
        profileData.name === "LinkedIn Member" ||
        profileData.name === "LinkedIn User"
      ) {
        profileData.name = "Professional";
      }
      // Add this after the skills extraction for debugging
      console.log("Skills section found:", !!skillsSection);
      console.log("Skills parent section:", skillsSection?.closest("section"));
      console.log(
        "All skill links:",
        skillsSection
          ?.closest("section")
          ?.querySelectorAll('a[data-field="skill_page_skill_topic"]')
      );

      console.log("Extracted profile data:", profileData);
      return profileData;
    } catch (error) {
      console.error("Error extracting profile data:", error);
      return {
        name: "Professional",
        headline: "",
        company: "",
        location: "",
        about: "",
        skills: [],
      };
    }
  }

  // Wait for page to load and DOM to be ready
  function waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", resolve);
      } else {
        resolve();
      }
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractProfile") {
      waitForDOM().then(() => {
        // Add a small delay to ensure dynamic content is loaded
        setTimeout(() => {
          const profileData = extractProfileData();
          sendResponse(profileData);
        }, 500);
      });

      // Keep the message channel open for async response
      return true;
    }
  });
})();
