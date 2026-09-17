import type { LandingCopy } from "./fr";

export const EN: LandingCopy = {
  nav: ["The platform", "How it works", "Your decision", "The demo"],
  discover: "Discover TenderPilot", demo: "Explore an analysis", explore: "Explore the platform",
  skip: "Skip to content", home: "TenderPilot — home", menu: "Open menu", close: "Close menu",
  light: "Switch to light theme", dark: "Switch to dark theme", language: "Choose your language",
  hero: {
    eyebrow: "A fresh perspective on your tenders",
    title: "Complex tenders.", emphasis: "Clear thinking.",
    description: "From tender documents to the decision to bid. TenderPilot helps you understand requirements, identify risks and focus your efforts on the right opportunities.",
    note: "Less uncertainty. More time for what matters.",
    stats: [["01", "One dossier", "All the pieces in one place"], ["02", "One analysis", "Requirements made clear"], ["03", "The evidence", "Sources within reach"], ["04", "Your decision", "A reasoned go / no-go"]],
  },
  features: {
    eyebrow: "The platform", title: "The bigger picture.\nWith every detail in view.",
    description: "Tenders are complex. Reading them shouldn’t be. Find the information that matters in a workflow built around the way you work.",
    items: [["Understand the requirements", "Identify administrative, technical and financial criteria in the tender documents."], ["Spot potential blockers", "Separate disqualifying criteria from missing information before committing your team."], ["Find every source", "Return to the original page and article to verify a requirement in context."], ["Compare with your profile", "Match the tender’s expectations against your references and company capabilities."], ["Prioritize the gaps", "Keep a clear view of missing evidence and points that need your attention."], ["Make an informed decision", "Support your go / no-go with a reasoned summary. The final decision stays with you."]],
  },
  workflow: {
    eyebrow: "How it works", title: "From documents to decision.\nIn three steps.",
    steps: [
      ["Bring your documents together", "Gather the tender documents and relevant information about your company.", "Your starting point", "Tender dossier", "Tender regulations · PDF", "Technical specifications · PDF", "Company profile and references"],
      ["Understand what’s at stake", "Review the requirements, their sources and the gaps to examine before bidding.", "A structured reading", "Points to review", "Administrative requirements", "Technical capabilities and references", "Disqualifying criteria and evidence"],
      ["Choose your next action", "Verify the critical points and share a supported decision with your team.", "A prepared decision", "Your go / no-go summary", "Potential blockers identified", "Sources and points to verify", "Final decision by your team"],
    ],
    preview: "Workflow preview", illustration: "Illustrative example",
  },
  infrastructure: {
    eyebrow: "Built around your work", title: "Dense documents.\nAn organized view.",
    description: "Tender regulations, specifications, references: each document holds part of the answer. TenderPilot connects them to help you see the whole picture.",
    items: [["The tender documents", "The scope and conditions of the contract."], ["Your company", "The capabilities and references to compare."], ["Points of attention", "What to check before you commit."]],
    rows: [["Tender regulations", "Participation conditions", "RC"], ["Technical specifications", "Needs and obligations", "CPS"], ["Company profile", "Capabilities and resources", "PROFILE"], ["References & certificates", "Supporting evidence", "FILES"]],
    footer: "The full picture, with the details in reach.",
  },
  metrics: {
    eyebrow: "Your decision", title: "More clarity.\nAt every checkpoint.", note: "Practical pointers for your review",
    items: [["Requirements", "What the tender asks for", "Read the criteria and their sources."], ["Gaps", "What still needs checking", "Identify missing information."], ["Blockers", "What could disqualify you", "Review the decisive conditions."], ["Go / no-go", "What you decide", "Make your call based on the facts."]],
    activity: "Your reading trail", feed: ["Requirement identified in the dossier", "Comparison with your profile", "Point of attention to verify"],
  },
  integrations: {
    eyebrow: "Your documents, simply", title: "Your source material.\nOur starting point.",
    description: "A workflow built around the documents you already use to prepare your bids.",
    items: [["Tender regulations", "Rules and conditions"], ["Specifications", "Contract requirements"], ["References", "Company experience"], ["Certificates", "Supporting documents"]],
    callout: "Context makes the difference.", detail: "A requirement only makes sense in relation to your company. Connect the tender’s expectations to the evidence that can support them.",
    example: ["Tender requirement", "A similar project reference requested", "Evidence to compare", "A relevant assignment from your company"],
  },
  security: {
    eyebrow: "An explainable analysis", title: "Trust starts\nwith transparency.",
    description: "A useful conclusion should be verifiable. Keep sources, uncertainties and your judgment at the center of the decision.",
    items: [["Traceable sources", "A page and article to recover the context of a requirement."], ["Explicit blockers", "Understand why a criterion could affect your eligibility."], ["Visible gaps", "Distinguish a missing document from an unmet criterion."], ["Contextual reading", "Compare requirements with your company’s profile and references."], ["Flagged uncertainties", "Incomplete information calls for human verification."], ["Human decisions", "The analysis supports you; your team has the final say."]],
    banner: "Decision support, backed by evidence.", bannerNote: "Always return to the original documents to validate the decisive points.",
  },
  demoSection: {
    eyebrow: "See for yourself", title: "A conclusion.\nAnd the reasons behind it.",
    description: "Explore this sample tender review. Move from the summary to the requirements, then to the sources that let you verify them.",
    points: [["A readable summary", "The decisive points come first."], ["Qualified requirements", "Points to verify are separated from available information."], ["Back to the document", "The source reference stays within reach."]],
    tabs: ["Summary", "Requirements", "Sources"], sample: "Fictional example · no customer data", tender: "Technical assistance assignment", reference: "TENDER · EXAMPLE 2026",
    verdict: "Verify before bidding", verdictText: "A similar project reference must be supported to confirm eligibility.",
    rows: [["Similar project reference", "To verify"], ["Proposed team", "Provided"], ["Administrative certificate", "To complete"]],
    sourceTitle: "Similar project reference", sourceRef: "RC · Article 6.2 · Page 8",
    quote: "The candidate shall provide at least one reference for an assignment of a similar nature.",
    sourceNote: "Fictional excerpt used solely to demonstrate how TenderPilot works.",
    openSource: "View source passage", closeSource: "Hide source passage", next: "Your next action", nextText: "Check the available reference and attach the corresponding supporting document.",
  },
  cta: { eyebrow: "Every bid begins with a choice", title: "What if your next tender\nfelt a little clearer?", description: "Get perspective on the requirements. Make time to build the right response.", secondary: "See the workflow", note: "Explore the example at your own pace." },
  footer: { description: "From reading the documents to deciding to bid. Your copilot for tender analysis.", columns: ["Platform", "The workflow", "TenderPilot"], links: [["Features", "Your documents", "Your decision"], ["The three steps", "Sample analysis", "The sources"], ["Our approach", "Discover TenderPilot", "Back to top"]], rights: "All rights reserved.", tagline: "Clarity before commitment." },
};
