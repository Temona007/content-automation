(function () {
  const PLATFORMS = {
    tiktok: { label: "TikTok", short: "TT" },
    instagram: { label: "Instagram", short: "IG" },
    youtube: { label: "YouTube", short: "YT" },
    x: { label: "X", short: "X" },
  };

  const HOOKS = [
    "This replaced three tools.",
    "Stop scrolling if your desk looks like this.",
    "The 8-second version.",
    "Nobody shows this part.",
    "Watch the color shift.",
    "Same clip. Different opening.",
    "We left it outside.",
    "Listen before you skip.",
  ];

  const GRADES = ["Warm", "Cool", "Neutral", "High contrast", "Soft film"];
  const OVERLAYS = ["Bold type", "Minimal", "Caption stack", "Lower third", "Clean"];

  function hoursFromNow(hours) {
    return new Date(Date.now() + hours * 3600 * 1000).toISOString();
  }

  function createSeed() {
    return {
      accounts: [
        { id: "a1", brand: "Northwind", platform: "tiktok", handle: "northwind", followers: 482000, views7d: 6100000, engagement: 5.4, status: "live", autopilot: true, postsWeek: 18, growth: 12.4 },
        { id: "a2", brand: "Northwind", platform: "instagram", handle: "northwind", followers: 291000, views7d: 2400000, engagement: 4.1, status: "live", autopilot: true, postsWeek: 14, growth: 6.2 },
        { id: "a3", brand: "Northwind", platform: "youtube", handle: "northwind", followers: 128000, views7d: 980000, engagement: 6.8, status: "live", autopilot: false, postsWeek: 6, growth: 3.1 },
        { id: "a4", brand: "Northwind", platform: "x", handle: "northwind", followers: 86000, views7d: 410000, engagement: 2.4, status: "live", autopilot: false, postsWeek: 11, growth: -1.2 },
        { id: "a5", brand: "Fieldnote", platform: "tiktok", handle: "fieldnote", followers: 190000, views7d: 3200000, engagement: 7.2, status: "live", autopilot: true, postsWeek: 16, growth: 18.6 },
        { id: "a6", brand: "Fieldnote", platform: "instagram", handle: "fieldnote", followers: 74000, views7d: 540000, engagement: 3.6, status: "paused", autopilot: false, postsWeek: 0, growth: 0.4 },
        { id: "a7", brand: "Harbor & Co", platform: "tiktok", handle: "harborandco", followers: 256000, views7d: 4100000, engagement: 5.9, status: "live", autopilot: true, postsWeek: 12, growth: 9.8 },
        { id: "a8", brand: "Lowlight", platform: "youtube", handle: "lowlight", followers: 64000, views7d: 720000, engagement: 8.1, status: "live", autopilot: true, postsWeek: 5, growth: 4.4 },
      ],
      clips: [
        { id: "c1", title: "Sampler in morning light", brand: "Northwind", accountId: "a1", duration: "0:21", views: 2400000, saves: 18400, shares: 9200, hook: "This replaced three tools.", grade: "Warm", hue: 24, postedAt: hoursFromNow(-48) },
        { id: "c2", title: "Pocket kit, three pockets", brand: "Northwind", accountId: "a2", duration: "0:14", views: 890000, saves: 6400, shares: 2100, hook: "Watch the color shift.", grade: "Neutral", hue: 200, postedAt: hoursFromNow(-96) },
        { id: "c3", title: "Field test in the rain", brand: "Northwind", accountId: "a3", duration: "0:34", views: 1200000, saves: 15200, shares: 4300, hook: "We left it outside.", grade: "Cool", hue: 208, postedAt: hoursFromNow(-144) },
        { id: "c4", title: "Desk reset in 15 seconds", brand: "Fieldnote", accountId: "a5", duration: "0:15", views: 3100000, saves: 40200, shares: 12100, hook: "Stop scrolling if your desk looks like this.", grade: "Soft film", hue: 38, postedAt: hoursFromNow(-26) },
        { id: "c5", title: "Paper texture, close", brand: "Fieldnote", accountId: "a5", duration: "0:11", views: 760000, saves: 9800, shares: 1400, hook: "Listen before you skip.", grade: "Warm", hue: 16, postedAt: hoursFromNow(-70) },
        { id: "c6", title: "Pour, steam, label", brand: "Harbor & Co", accountId: "a7", duration: "0:18", views: 1680000, saves: 22100, shares: 5600, hook: "The 8-second version.", grade: "High contrast", hue: 152, postedAt: hoursFromNow(-50) },
        { id: "c7", title: "Dimmer, one turn", brand: "Lowlight", accountId: "a8", duration: "0:27", views: 640000, saves: 8700, shares: 1900, hook: "Nobody shows this part.", grade: "Cool", hue: 262, postedAt: hoursFromNow(-120) },
        { id: "c8", title: "Packing the weekender", brand: "Northwind", accountId: "a1", duration: "0:19", views: 430000, saves: 2100, shares: 800, hook: "Same clip. Different opening.", grade: "Neutral", hue: 78, postedAt: hoursFromNow(-190) },
      ],
      variants: [
        { id: "v1", clipId: "c4", hook: "Stop scrolling if your desk looks like this.", grade: "Soft film", overlay: "Bold type", score: 93, reach: 980000, status: "queued", created: hoursFromNow(-5) },
        { id: "v2", clipId: "c4", hook: "The 8-second version.", grade: "Soft film", overlay: "Minimal", score: 86, reach: 640000, status: "draft", created: hoursFromNow(-5) },
        { id: "v3", clipId: "c4", hook: "Nobody shows this part.", grade: "Warm", overlay: "Caption stack", score: 78, reach: 410000, status: "draft", created: hoursFromNow(-4) },
        { id: "v4", clipId: "c1", hook: "This replaced three tools.", grade: "Warm", overlay: "Bold type", score: 94, reach: 760000, status: "draft", created: hoursFromNow(-20) },
        { id: "v5", clipId: "c1", hook: "Watch the color shift.", grade: "Warm", overlay: "Lower third", score: 84, reach: 520000, status: "draft", created: hoursFromNow(-18) },
      ],
      queue: [
        { id: "q1", clipId: "c4", accountId: "a5", variantId: "v1", at: hoursFromNow(6), status: "scheduled", caption: "Stop scrolling if your desk looks like this." },
        { id: "q2", clipId: "c6", accountId: "a7", variantId: null, at: hoursFromNow(28), status: "scheduled", caption: "The 8-second version." },
        { id: "q3", clipId: "c1", accountId: "a1", variantId: null, at: hoursFromNow(32), status: "scheduled", caption: "This replaced three tools." },
        { id: "q4", clipId: "c7", accountId: "a8", variantId: null, at: hoursFromNow(52), status: "scheduled", caption: "Nobody shows this part." },
        { id: "q5", clipId: "c2", accountId: "a2", variantId: null, at: hoursFromNow(76), status: "scheduled", caption: "Watch the color shift." },
        { id: "q6", clipId: "c4", accountId: "a5", variantId: null, at: hoursFromNow(-8), status: "posted", caption: "Desk reset, original cut." },
        { id: "q7", clipId: "c6", accountId: "a7", variantId: null, at: hoursFromNow(-30), status: "posted", caption: "Pour, steam, label." },
        { id: "q8", clipId: "c3", accountId: "a3", variantId: null, at: hoursFromNow(-54), status: "posted", caption: "We left it outside." },
      ],
    };
  }

  window.RelayData = { createSeed, HOOKS, GRADES, OVERLAYS, PLATFORMS };
})();
