const MEDIA_PIPE = {
  packageUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest",
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
  detectDelay: 120,
  minEmotionDuration: 1200,
};

const MOTION_SPEED = {
  gradient: 0.035,
  radius: 0.08,
  story: 0.08,
  text: 0.08,
  feedImageScale: 0.08,
  wow: 0.9,
};

const EMOTIONS = {
  neutral: emotion({
    threshold: Infinity,
    color: [255, 255, 255],
    gradient: { top: [255, 255, 255], bottom: [255, 255, 255] },
  }),
  happy: emotion({
    threshold: 0.35,
    color: [247, 177, 45],
    gradient: { top: [255, 244, 211], bottom: [250, 212, 142] },
  }),
  sad: emotion({
    threshold: 0.08,
    color: [96, 159, 192],
    gradient: { top: [96, 159, 192], bottom: [158, 203, 226] },
    storyRingWeight: 2,
    textSpacing: 1,
  }),
  wow: emotion({
    threshold: 0.35,
    color: [180, 120, 240],
    gradient: { top: [216, 180, 255], bottom: [142, 68, 173] },
    storyRadius: 18.5,
    glow: true,
  }),
  angry: emotion({
    threshold: 0.35,
    color: [248, 93, 58],
    gradient: { top: [241, 171, 148], bottom: [248, 151, 120] },
    storyRadius: 0,
    fontWeight: 700,
  }),
};

const REACTION_ORDER = ["happy", "sad", "wow", "angry"];
const EMPTY_SCORES = { happy: 0, sad: 0, wow: 0, angry: 0 };

const ASSET_PATHS = {
  feedPhotos: {
    happy: "Images/Feed-Happy.png",
    angry: "Images/Feed-Angry.png",
    sad: "Images/Feed-Sad.png",
    wow: "Images/Feed-Wow.png",
  },
  reactionIcons: {
    happy: "Images/Icons/reaction-haha.png",
    wow: "Images/Icons/reaction-wow.png",
    sad: "Images/Icons/reaction-sad.png",
    angry: "Images/Icons/reaction-angry.png",
  },
  uiIcons: {
    like: "Images/Icons/like-icon.png",
    comment: "Images/Icons/comment-icon.png",
    home: "Images/Icons/home-icon.png",
  },
};

const STORY_NAMES = [
  "schoolofform",
  "michcarlos",
  "soniakieryl",
  "haniasri",
  "mila_17",
  "matejaden",
];

const STORY_RING_COLORS = [
  [247, 177, 45],
  [255, 93, 0],
  [247, 177, 45],
  [40, 119, 143],
  [247, 177, 45],
  [255, 93, 0],
];

const POST_DATA = [
  { photoKey: "happy", profile: 2, name: "soniakieryl", emotion: "happy" },
  { photoKey: "angry", profile: 3, name: "haniasri", emotion: "angry" },
  { photoKey: "sad", profile: 4, name: "mila_17", emotion: "sad" },
  { photoKey: "wow", profile: 5, name: "matejaden", emotion: "wow" },
];

const LAYOUT = {
  canvasWidth: 1440,
  header: {
    titleX: 720,
    titleY: 42,
    underlineX: 668,
    underlineY: 61,
    underlineW: 104,
  },
  sideMenu: { x: 20, gap: 82 },
  story: { startX: 420, y: 96, gap: 105, ring: 80, image: 74 },
  post: { x: 480, firstY: 270, gap: 640, activeCenterOffset: 320 },
  reaction: {
    xFromRight: 230,
    yFromBottom: 64,
    gap: 36,
    width: 160,
    height: 18,
  },
};

let feedPhotos = {};
let profiles = [];
let reactionIcons = {};
let uiIcons = {};
let posts = [];

let video;
let faceLandmarker;
let mediaPipeReady = false;
let lastMediaPipeDetect = 0;
let lastEmotionChange = 0;

let feedScroll = 0;
let currentEmotion = "neutral";
let scores = { ...EMPTY_SCORES };

let motion;

async function setup() {
  createCanvas(LAYOUT.canvasWidth, windowHeight);
  textFont("Inter");
  await loadAssets();
  initMotion();
  setupCameraEmotionDetection();
}

function draw() {
  if (!motion) return;

  detectFaceEmotion();
  updateMotion();
  drawBackground();

  push();
  translate(0, -feedScroll);
  drawHeader();
  drawStories();
  drawPosts();
  pop();

  drawSideMenu();
  drawReactionLevels();
}

function emotion(config) {
  return {
    storyRadius: 37,
    storyRingWeight: 4,
    textSpacing: 0,
    fontWeight: 400,
    glow: false,
    ...config,
  };
}

async function loadAssets() {
  feedPhotos = await loadImageMap(ASSET_PATHS.feedPhotos);
  reactionIcons = await loadImageMap(ASSET_PATHS.reactionIcons);
  uiIcons = await loadImageMap(ASSET_PATHS.uiIcons);

  profiles = [];
  for (let i = 1; i <= 6; i++) {
    profiles.push(await loadImage("Images/Profiles/Profile-" + i + ".png"));
  }

  posts = POST_DATA.map((post) => ({
    ...post,
    image: feedPhotos[post.photoKey],
    reaction: null,
  }));
}

async function loadImageMap(paths) {
  let images = {};

  for (let key in paths) {
    images[key] = await loadImage(paths[key]);
  }

  return images;
}

function initMotion() {
  let neutral = EMOTIONS.neutral;

  motion = {
    current: {
      gradientTop: color(neutral.gradient.top),
      gradientBottom: color(neutral.gradient.bottom),
      elementRadius: 0,
      storyRadius: neutral.storyRadius,
      storyRingWeight: neutral.storyRingWeight,
      textSpacing: neutral.textSpacing,
      feedImageScale: 1,
      wow: 0,
    },
    target: {
      gradientTop: color(neutral.gradient.top),
      gradientBottom: color(neutral.gradient.bottom),
      elementRadius: 0,
      storyRadius: neutral.storyRadius,
      storyRingWeight: neutral.storyRingWeight,
      textSpacing: neutral.textSpacing,
      feedImageScale: 1,
    },
  };
}

function updateMotion() {
  smoothColor("gradientTop", MOTION_SPEED.gradient);
  smoothColor("gradientBottom", MOTION_SPEED.gradient);
  smoothValue("elementRadius", MOTION_SPEED.radius);
  smoothValue("storyRadius", MOTION_SPEED.story);
  smoothValue("storyRingWeight", MOTION_SPEED.story);
  smoothValue("textSpacing", MOTION_SPEED.text);
  smoothValue("feedImageScale", MOTION_SPEED.feedImageScale);
  motion.current.wow *= MOTION_SPEED.wow;
}

function smoothValue(name, speed) {
  motion.current[name] = lerp(motion.current[name], motion.target[name], speed);
}

function smoothColor(name, speed) {
  motion.current[name] = lerpColor(
    motion.current[name],
    motion.target[name],
    speed,
  );
}

function drawBackground() {
  let gradient = drawingContext.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, cssColor(motion.current.gradientTop));
  gradient.addColorStop(1, cssColor(motion.current.gradientBottom));

  drawingContext.save();
  drawingContext.fillStyle = gradient;
  drawingContext.fillRect(0, 0, width, height);

  if (motion.current.wow > 0.01) {
    let glow = drawingContext.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      height * 0.75,
    );
    glow.addColorStop(
      0,
      "rgba(235, 215, 255, " + 0.45 * motion.current.wow + ")",
    );
    glow.addColorStop(1, "rgba(235, 215, 255, 0)");
    drawingContext.fillStyle = glow;
    drawingContext.fillRect(0, 0, width, height);
  }

  drawingContext.restore();
}

function cssColor(value) {
  return (
    "rgba(" +
    red(value) +
    ", " +
    green(value) +
    ", " +
    blue(value) +
    ", " +
    alpha(value) / 255 +
    ")"
  );
}

function applyEmotionTextStyle() {
  let weight = EMOTIONS[currentEmotion].fontWeight;

  if (typeof fontWeight == "function") {
    fontWeight(weight);
  } else {
    textStyle(weight > 400 ? BOLD : NORMAL);
  }
}

function drawEmotionText(words, x, y, spacing) {
  let oldSpacing = drawingContext.letterSpacing || "0px";

  drawingContext.letterSpacing = spacing * motion.current.textSpacing + "px";
  text(words, x, y);
  drawingContext.letterSpacing = oldSpacing;
}

function drawHeader() {
  let header = LAYOUT.header;

  noStroke();
  fill(0, 204);
  textAlign(CENTER, CENTER);
  textSize(18);
  applyEmotionTextStyle();
  drawEmotionText("Dla Ciebie", header.titleX, header.titleY, 3);

  stroke(0, 25);
  strokeWeight(1.5);
  line(
    header.underlineX,
    header.underlineY,
    header.underlineX + header.underlineW,
    header.underlineY,
  );
}

function drawSideMenu() {
  let menu = LAYOUT.sideMenu;
  let iconGroupY = height / 2 - 63;

  image(uiIcons.home, menu.x, iconGroupY, 26, 23);
  image(uiIcons.like, menu.x, iconGroupY + menu.gap, 22, 20);
}

function windowResized() {
  resizeCanvas(LAYOUT.canvasWidth, windowHeight);
  feedScroll = constrain(feedScroll, 0, getMaxScroll());
}

function mouseWheel(event) {
  feedScroll = constrain(feedScroll + event.delta, 0, getMaxScroll());
  return false;
}

function getMaxScroll() {
  return max(0, LAYOUT.post.firstY + posts.length * LAYOUT.post.gap - height);
}

async function setupCameraEmotionDetection() {
  video = createCapture(VIDEO);
  video.size(320, 240);
  video.hide();

  try {
    await startMediaPipe("GPU");
  } catch (error) {
    try {
      await startMediaPipe("CPU");
    } catch (cpuError) {
      mediaPipeReady = false;
    }
  }
}

async function startMediaPipe(delegateName) {
  let mediaPipe = await import(MEDIA_PIPE.packageUrl);
  let vision = await mediaPipe.FilesetResolver.forVisionTasks(
    MEDIA_PIPE.wasmUrl,
  );

  faceLandmarker = await mediaPipe.FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MEDIA_PIPE.modelUrl,
      delegate: delegateName,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
  mediaPipeReady = true;
  lastEmotionChange = millis();
}

function detectFaceEmotion() {
  if (!canDetectEmotion()) return;
  if (millis() - lastMediaPipeDetect < MEDIA_PIPE.detectDelay) return;

  lastMediaPipeDetect = millis();
  let result = faceLandmarker.detectForVideo(video.elt, performance.now());

  if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
    scores = getEmotionScores(result.faceBlendshapes[0].categories);
    motion.target.elementRadius = getImageRadius(scores);
    motion.target.feedImageScale = getFeedImageScale(scores);

    if (millis() - lastEmotionChange > MEDIA_PIPE.minEmotionDuration) {
      checkEmotion(scores);
    }
  } else {
    resetEmotion();
  }
}

function canDetectEmotion() {
  return (
    mediaPipeReady &&
    faceLandmarker &&
    video &&
    video.elt &&
    video.elt.readyState >= 2
  );
}

function resetEmotion() {
  scores = { ...EMPTY_SCORES };
  motion.target.elementRadius = 0;
  motion.target.feedImageScale = 1;
  setEmotion("neutral");
}

function getEmotionScores(categories) {
  let score = scoreMap(categories);
  let value = (name) => score[name] || 0;
  let avg = (...names) =>
    names.reduce((sum, name) => sum + value(name), 0) / names.length;

  return {
    happy: constrain(avg("mouthSmileLeft", "mouthSmileRight") * 1.25, 0, 1),
    sad: constrain(
      avg("mouthFrownLeft", "mouthFrownRight") * 3.2 +
        value("browInnerUp") * 1.1 +
        avg("mouthStretchLeft", "mouthStretchRight") * 0.45,
      0,
      1,
    ),
    angry: constrain(
      avg("browDownLeft", "browDownRight") * 1.2 +
        avg("eyeSquintLeft", "eyeSquintRight") * 0.4 +
        avg("mouthPressLeft", "mouthPressRight") * 0.3,
      0,
      1,
    ),
    wow: constrain(
      avg("browInnerUp", "browOuterUp") * 1.5 + value("jawOpen") * 1.5,
      0,
      1,
    ),
  };
}

function scoreMap(categories) {
  let scoresByName = {};

  for (let i = 0; i < categories.length; i++) {
    scoresByName[categories[i].categoryName] = categories[i].score;
  }

  return scoresByName;
}

function checkEmotion(expressions) {
  let bestEmotion = REACTION_ORDER.reduce((best, emotion) => {
    let score = expressions[emotion];
    let beatsThreshold = score > EMOTIONS[emotion].threshold;
    let beatsCurrent = score > (expressions[best] || 0);
    return beatsThreshold && beatsCurrent ? emotion : best;
  }, "neutral");

  setEmotion(bestEmotion);
}

function setEmotion(emotion) {
  if (emotion == currentEmotion || !EMOTIONS[emotion]) return;

  let config = EMOTIONS[emotion];
  currentEmotion = emotion;
  motion.target.gradientTop = color(config.gradient.top);
  motion.target.gradientBottom = color(config.gradient.bottom);
  motion.target.storyRadius = config.storyRadius;
  motion.target.storyRingWeight = config.storyRingWeight;
  motion.target.textSpacing = config.textSpacing;

  if (config.glow) motion.current.wow = 1;

  saveReactionOnActivePost(emotion);
  lastEmotionChange = millis();
}

function saveReactionOnActivePost(emotion) {
  if (emotion == "neutral") return;

  let activePost = getActivePost();
  if (activePost) activePost.reaction = emotion;
}

function emotionColor(emotion) {
  return color(EMOTIONS[emotion]?.color || [255, 255, 255]);
}

function getActivePost() {
  let postLayout = LAYOUT.post;
  let viewCenterY = feedScroll + height / 2;
  let index = round(
    (viewCenterY - postLayout.firstY - postLayout.activeCenterOffset) /
      postLayout.gap,
  );

  return posts[constrain(index, 0, posts.length - 1)];
}

function drawReactionLevels() {
  for (let i = 0; i < REACTION_ORDER.length; i++) {
    let emotion = REACTION_ORDER[i];
    drawReactionLevel(emotion, reactionIcons[emotion], scores[emotion], i);
  }
}

function drawReactionLevel(emotionName, iconImg, scoreValue, index) {
  let bar = LAYOUT.reaction;
  let barX = width - bar.xFromRight;
  let barY = height - bar.yFromBottom - index * bar.gap;
  let fillW = bar.width * scoreValue;

  noStroke();
  fill(0, 38);
  rect(barX, barY, bar.width, bar.height, 70);

  if (fillW > 0) {
    fill(emotionColor(emotionName));
    rect(barX, barY, fillW, bar.height, 70);
  }

  stroke(0, 20);
  strokeWeight(1);
  noFill();
  rect(barX, barY, bar.width, bar.height, 70);

  image(iconImg, barX - 8, barY - 10, 32, 32);
}

function getImageRadius(expressions) {
  let happyRadius = lerp(0, 30, constrain(expressions.happy * 3.3, 0, 1));
  let sadRadius = lerp(0, 20, expressions.sad);

  return constrain(happyRadius + sadRadius, 0, 82);
}

function getFeedImageScale(expressions) {
  let wowScore = constrain(expressions.wow, 0, 1);
  let sadScore = constrain(expressions.sad, 0, 1);

  if (sadScore > EMOTIONS.sad.threshold && sadScore >= wowScore) {
    return lerp(1, 0.85, sadScore);
  }

  if (wowScore <= EMOTIONS.wow.threshold) return 1;

  return lerp(1, 1.08, wowScore);
}

function roundedImage(img, x, y, w, h, radius, scale = 1) {
  let scaledW = w * scale;
  let scaledH = h * scale;
  let scaledX = x - (scaledW - w) / 2;
  let scaledY = y - (scaledH - h) / 2;

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.roundRect(scaledX, scaledY, scaledW, scaledH, radius * scale);
  drawingContext.clip();
  image(img, scaledX, scaledY, scaledW, scaledH);
  drawingContext.restore();
}

function drawStories() {
  let story = LAYOUT.story;

  for (let i = 0; i < STORY_NAMES.length; i++) {
    let x = story.startX + i * story.gap;

    drawStoryRing(x, story.y, i);
    roundedImage(
      profiles[i],
      x + 7,
      story.y + 7,
      story.image,
      story.image,
      motion.current.storyRadius,
    );

    noStroke();
    fill(12, 17, 21);
    textAlign(CENTER, TOP);
    textSize(12);
    applyEmotionTextStyle();
    drawEmotionText(STORY_NAMES[i], x + 44, story.y + 91, 1.5);
  }
}

function drawStoryRing(x, y, index) {
  let ring = LAYOUT.story.ring;

  noFill();
  stroke(...STORY_RING_COLORS[index]);
  strokeWeight(motion.current.storyRingWeight);
  rect(x + 4, y + 4, ring, ring, motion.current.storyRadius + 3);
}

function drawPosts() {
  let postLayout = LAYOUT.post;

  for (let i = 0; i < posts.length; i++) {
    drawPost(posts[i], postLayout.firstY + i * postLayout.gap);
  }
}

function drawPost(post, postY) {
  let postX = LAYOUT.post.x;
  let imageRadius = motion.current.elementRadius;

  roundedImage(profiles[post.profile], postX + 12, postY, 32, 32, imageRadius);

  noStroke();
  fill(12, 17, 21);
  textAlign(LEFT, CENTER);
  textSize(14);
  applyEmotionTextStyle();
  drawEmotionText(post.name, postX + 56, postY + 16, 2);

  roundedImage(
    post.image,
    postX,
    postY + 45,
    468,
    473,
    imageRadius * 3,
    motion.current.feedImageScale,
  );
  drawPostReaction(post, postX, postY + 530);
  image(uiIcons.comment, postX + 45, postY + 530, 25, 20);
}

function drawPostReaction(post, x, y) {
  if (post.reaction) {
    image(reactionIcons[post.reaction], x - 5, y - 6, 34, 34);
  } else {
    image(uiIcons.like, x, y, 22, 20);
  }
}
