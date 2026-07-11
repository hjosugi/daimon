<!-- i18n: language-switcher -->
[English](RESEARCH.en.md) | [日本語](RESEARCH.md)

# DAIMON — Research & Theoretical Dossier (Armory / Complete Edition)

Last Updated: June 2026
Role: This is a **deep research foundation (background & armory for interviews)** supporting the design of daimon.
The core judgments of the product are elsewhere:
- What to create (theory → features): [`THEORY_TO_FEATURES.md`](THEORY_TO_FEATURES.md)
- Product/UX: [`PRODUCT_AND_UX.md`](PRODUCT_AND_UX.md)
- Priorities: [`ROADMAP.md`](ROADMAP.md)
- Compression notes: [`CONCEPT_AND_RESEARCH.txt`](CONCEPT_AND_RESEARCH.txt)

Principle: **The foundation is deep, the surface is one gesture (Tesler's Law).** This document covers everything on the "foundation" side.
Legend: ✓ = Confirmed via bibliographic check through web search in this session / * = Memory-based (needs final confirmation for year/volume/issue).

---

## 0. In a sentence

Daimon is not about "streaming subjective posts as they are," but about decomposing and accumulating subjectivity into **perspectives (POV / the axis you are speaking from)**, creating a dialogue space where even people with differing opinions can connect safely and deeply through the shared point: "We see the same thing but feel differently."
It's not just SNS or pure bulletin boards—it's "a place to touch others' sensibility structures through POV."

In a nutshell:
> Meeting lightly with someone who sees the same thing but feels differently.

---

## 1. The challenges we aim to solve

**1.1 Side effects of engagement-optimized feedback loops**
Major SNS platforms optimize for "maximizing stay and reactions," leading to:
(a) Amplification of emotionally divisive content,
(b) Filter bubbles / echo chambers,
(c) Encounters with differing views only through "conflict."
→ Pariser's *Filter Bubble*, Bakshy et al. (Science, 2015), Sunstein's *#Republic*, Brady et al. (2017, spreading moral-emotional content), Iyengar et al. (2019).

**1.2 Coarse units like "Like/dislike / points"**
Sensibility is multi-axial ("good scenario but bad tempo"). Reducing to a single scalar loses the richest connection points like partial matches/mismatches.
→ POV structures in ErogameScape, Aspect-Based Sentiment Analysis.

**1.3 Homophily in follow graphs**
Valuable information often comes from weak ties, but SNS follow graphs lack pathways for this.
→ Granovetter, Burt.

**1.4 The "casual ↔ deep" dilemma**
Tools for deep discussion are high-threshold and hard to sustain; casual SNS lack depth.
Daimon uses "one tap" actions as entry points, with a two-layer system that accumulates sensibility structures behind the scenes.

**1.5 Fundamental question**
"Is it possible to design interactions that turn conflicts from 'ratio-based / flame wars' into 'connections'?"
Key new primitive = **co-axial disagreement** (opinions differ but perspectives are the same).
Normal SNS leads to conflict; in POV spaces, it becomes the most educational dialogue.

---

## 2. Core idea: Making perspectives (POV) first-class citizens

Instead of the minimal data unit being "post + tags,"
```
post
 └─ POV assertion (perspective claim)
      ├─ POV      : "Good scenario", "Bad tempo"
      ├─ stance/lean : empathy / questioning / discomfort (pop: "I see", "Interesting", "Maybe different")
      ├─ comment  : Why do you see it that way?
      ├─ user
      └─ (future) spoiler / confidence
```

"Comments on the post" and "POV comments" are different:
- The former discusses "this post,"
- The latter discusses "how it looks from this perspective."
This shifts dialogue from "person vs person" to "shared ground of perspectives."
POV simultaneously functions as: evaluation axis / search tags / recommendation features / discussion threads / self-introduction / measures of distance to others.

---

## 3. Sense-Distance Ranking (Signature feature)

```
base = α·near + (1−α)·bridge + 0.15·common_ground [+ 0.20·popularity + 0.10·recency]
final = MMR(base, λ)   # removes redundancy (ensures diversity)
```
near = close to user's sense (empathy) / bridge = distant but sharing a specific POV (weak tie / co-axial disagreement) /
common_ground = coverage of shared POV / popularity = likes + 3×saves / recency = freshness /
MMR = Carbonell & Goldstein (1998).

Future theoretically sound extension:
```
score = semantic_similarity + shared_pov_weight + pov_activity_recency
      + pov_comment_quality + user_affinity_by_pov + disagreement_but_same_axis_bonus
```
The last term (if viewpoints are on the same axis, even if conclusions differ, it gets ranked higher) is a personal version of bridging-based ranking.

---

## 4. Architecture (Key points)

- Frontend: React 19 + Vite + TS + Tailwind v4 + react-query
- API: Go (chi / pgx / custom Qdrant REST client). SQL centralized in dbq registry.
- ML: Python (FastAPI) — only `/embed` (sentence-transformers) and `/povs` (spaCy).
- Vector DB: Qdrant (Cosine, 384D). RDB: PostgreSQL. Cache: Redis.
- Batch (Go): timeline pre-calculation / suggestion pre-calculation / deep analysis of long posts.
- Shared vector operations in `internal/vec` (Mean/BlendSaved/ChunkRunes).

**Embedding model choice:** `paraphrase-multilingual-MiniLM-L12-v2` (384D, multilingual).
Old `all-MiniLM-L6-v2` was English-only, causing Japanese vectors to collapse, making search only ~40% match and non-functional.
Maintaining 384D avoids re-architecting Qdrant and halves memory compared to 768D.
Model change requires **full re-seed** (Reimers & Gurevych 2019/2020).

**Long texts & deep analysis:**
Max 40,000 characters per post. MiniLM models cut off around 128 tokens, so use `max_seq_length=512` + chunk pooling to embed entire posts. Batch deep-analyze automatically decomposes long texts into multiple POVs. Deep encoding based on Craik & Lockhart (1972).

---

## 5. Correspondence between architecture & science (core of this document)

### 5.1 Neuroscience (“communication” and “distance” exist at brain level)

- **Communication = brain synchronization** ✓ Stephens, Silbert & Hasson (2010, PNAS 107:14425–14430).
Speaker and listener brain activities synchronize in space-time; if "not transmitted," the connection disappears.
Pre-anticipatory (predictive) coupling enhances understanding. → "Communication" is not just metaphor but actual brain synchronization. POV provides the basis for this coupling.
- **Closeness of sensibility = neural response similarity, decays with social distance** ✓ Parkinson, Kleinbaum & Wheatley (2018, Nat. Commun. 9:332).
Neural response similarity during natural video viewing is highest among close friends, decreases with social distance. → Neural reality of Sense-Distance.
- **Self-disclosure is inherently rewarding** ✓ Tamir & Mitchell (2012, PNAS 109(21):8038–8043).
Self-disclosure activates midbrain limbic dopamine systems (nucleus accumbens, ventral tegmental area); people pay money to disclose.
→ "Writing perspectives / indicating stance" itself is neuro-reward. Light entry points enable intrinsic motivation.
- **Mentalizing network**: mPFC, TPJ, precuneus.
* Saxe & Kanwisher (2003, TPJ), * Mitchell, Macrae & Banaji (2006, Neuron):
  Similar others → ventral mPFC; dissimilar others → dorsal mPFC.
→ Brain processing diverges for "similar" vs "distant" people. Daimon safely presents distant perspectives via shared POV, reducing mentalizing load.
- **Curiosity & dopamine/hippocampal learning**: * Kang et al. (2009), * Gruber, Gelman & Ranganath (2014).
Co-axial disagreement creates "prediction gaps" → curiosity → learning → memory. Converts conflict into learning reward.
- **Predictive processing / free energy principle**: * Friston (2010), * Clark (2013).
New, grounded info (distant but shared axis) is the best learning source. Bridge aims at optimal prediction error.
- **Exaggeration avoidance**: Mirror neuron "empathy seat" interpretations are exaggerated (*Hickok 2014), oxytocin "trust hormone" has reproducibility issues (*Nave et al. 2015).
Daimon relies on robust findings of neural coupling / neural similarity / reward from self-disclosure.

### 5.2 Psychology (“perspective decomposition” and “cross-distance” influence people)

- **Contact hypothesis**: * Allport (1954), * Pettigrew & Tropp (2006 meta-analysis).
Conditional contact reduces prejudice. → Contact with distant views via shared POV as a foundation.
- **"Perspective taking" vs "listening"**: * Eyal, Steffel & Epley (2018, JPSP 114:547–571).
Imagination (taking) lowers accuracy but increases confidence. 25 experiments.
"Other people's minds are expressed through speech." → POV should be an "listening device" for understanding, not guessing.
- **Self-expansion & intimacy experiments**: ✓ Aron et al. (1997), * Reis & Shaver.
Gradual, mutual self-disclosure fosters intimacy in 45 min. + Design for "casual deepening" via incremental self-disclosure (POV → stance → why → dialogue).
- **Processing levels**: * Craik & Lockhart (1972).
Deeper semantic processing → longer retention → long texts & perspective-based argumentation.
- **Cognitive dissonance & confirmation bias**: * Festinger (1957), * Nickerson (1998).
People select confirming info → without explicit design of shared POV basis, they automatically form echo chambers.
- **Information gap & curiosity**: * Loewenstein (1994).
Optimal gap between known & unknown. → Engineering the distance in bridge.
- **Interpretation level theory / psychological distance**: * Trope & Liberman (2010).
- **Moral reframing**: * Feinberg & Willer (2015), * Haidt (2012).
Reframe the same event from different moral axes.
- **Shared reality**: * Hardin & Higgins (1996), * Echterhoff et al. (2009).
Shared POV = small shared reality.
- **Intellectual humility**: * Leary et al. (2017).
Make "question" and "discomfort" primary in UI.
- **Cognitive needs / optimal differentiation**: * Cacioppo & Petty (1982), * Brewer (1991).
"Same perspective (assimilation) but different stance (differentiation)" = optimal differentiation itself.

### 5.3 Social sciences / networks (“value of distance”)

- * Granovetter (1973), * Burt (1992, 2004), * Putnam (2000).
Weak ties / structural holes / bonding vs bridging.
- Polarization / echo chambers: * Iyengar et al. (2019), * Sunstein (2017), * Bail (2021).
Simple exposure to opposing opinions can harden views; how exposure is done matters.
- Opinion dynamics: * Hegselmann & Krause (2002), * Deffuant et al. (2000), * Axelrod (1997).
Bridge manipulates trust boundaries of individuals.

### 5.4 Deliberation / Civic Tech / HCI (group-level implementations)

- **Pol.is (key example)** ✓ Small, Bjorkegren, Erkkilä, Shaw & Megill (2021).
Dimensionality reduction of opinions via PCA, placing people in opinion space, revealing consensus points across groups. Used in Taiwan vTaiwan for policy consensus (Uber regulation, etc.).
- **Bridging-based ranking / Community Notes** ✓ Wojcik et al. (2022).
Unsupervised opinion space via matrix factorization, showing only points supported by both sides. Not majority vote. Bridging notes reduce misinformation likes/reposts by 25–34%.
+ * Ovadya (2022).
Supports "disagreement_but_same_axis_bonus."
- Structured deliberation UI: * Kriplean et al. (2012), Kialo.
- Common communication foundation: * Clark & Brennan (1991).
POV = explicit unit of shared ground.

### 5.5 Computer science / NLP / IR / Recommender systems (implementation backbone)

- Text embedding: * Reimers & Gurevych (2019 SBERT; 2020 multilingual distillation), * Devlin et al. (2019 BERT), * Mikolov et al. (2013 word2vec).
- Perspective decomposition = ABSA / stance: * Pontiki et al. (2014), * Hu & Liu (2004), * Mohammad et al. (2016).
- Diversity / serendipity: * Carbonell & Goldstein (1998, MMR), * Ge et al. (2010), * Zhang et al. (2012), * Nguyen et al. (2014).
- Vector search: * Johnson, Douze & Jégou (2017, FAISS), * Malkov & Yashunin (2018, HNSW). Qdrant follows this lineage.

### 5.6 Exploratory instincts & reward (graph search & intrinsic reward UI)

**Two types of innate reward, one of which is an enemy of daimon.**

- **Dopamine = "wanting/incentive salience" rather than pleasure** ✓ Berridge & Robinson (incentive salience theory; Berridge 2007).
"Wanting" and "liking" are separate systems. Dopamine drives pursuit & expectation motivation.
- **Seeking system** ✓ Panksepp (Affective Neuroscience).
VTA-originating circuit for exploration, curiosity, expectation. Driven by "anticipation" rather than reward itself.
- **Information foraging** ✓ Pirolli & Card (1999).
Humans follow "scent" in information patches, similar to animal foraging. Graph exploration view is based on this scent; if scent exists, seeking activates.
- **Information as dopamine reward** * Bromberg-Martin & Hikosaka (2009).
Same dopamine neurons signal primary reward and "future info."
- **Active sampling & curiosity** ✓ Gottlieb & Oudeyer (2018).
Distinguishes "sampling" (reducing uncertainty of known tasks) and "search" (discovery), driven by learning progress.
- **Self-disclosure reward** ✓ Tamir & Mitchell (2012).
Simply expressing a word is rewarding; entry point is lightweight.

**Design rules (boundaries):**
- Use = "find/connect/understand" → satisfying reward (SEEKING / closure / self-disclosure / learning progress).
- Reject = "designed to remain unsatisfied" rewards = variable-ratio slot machine (endless scroll / continuous record / like count ranking / red badge notifications / FOMO).
→ Avoid force-directed graph search; instead, do **sense-distance guided scent foraging** (second mode). Rewards close with closure ("we are the same here").

---

## 6. Design principle: Tesler's Law (Conservation of Complexity)

* Larry Tesler, Law of Conservation of Complexity.
Any system inherently contains unavoidable complexity; the question is "who bears it — user, developer, platform?"
→ "The simpler and poppier it looks, the deeper its foundation" is not just a clever observation but a restatement of this law.
Behind a search box or "Did you find it?" tap on Community Notes lies deep system complexity.
Daimon embeds vector/bridging/sense-distance/perspective decomposition entirely into the system, exposing only one gesture to the user.
This is the divergence point from ErogameScape (which makes stats explicit).

Related research: * Sorensen et al. (2024, "A roadmap to pluralistic alignment", arXiv:2402.05070), * Ovadya's "Generative CI through Collective Response Systems" (arXiv:2302.00672).

---

## 7. Latest research (2023–2026): AI-mediated deliberation / social choice generation / bridging validation

- ✓ **Tessler, Summerfield, et al. (2024, Science 386(6719), DeepMind "Habermas Machine")**.
5,734 people in the UK. LLM extracts *overlap* from individual free texts to generate collective statements, rated as clearer and fairer than human facilitators, reducing division after discussion, and not marginalizing minority opinions.
Training goal: not "persuade" but "mediate."
→ AI-mediated version of daimon's "co-axial disagreement → common ground." **Most important recent example.**
Note: "Equal weight to all perspectives" is not fair; proportionality based on stakes is needed (criticisms & future issues).
- ✓ **Fish, Gölz, Procaccia, et al. (2023 arXiv:2309.01291; 2025 "The Next Generation")**.
Generative Social Choice. Considers *all* utterances as candidates, uses LLM to generate consensus statements, predicts preferences.
- * **PoliCon (2025, arXiv:2505.19558)**.
Evaluates LLM's ability to draft consensus resolutions based on 2,225 European Parliament cases (2009–2022).
- ✓ **Limitations of Community Notes (2024–2025, PNAS, etc.)**.
Displayed notes decrease by about 10%, sensitive to evaluator bias, and less accurate on divisive topics (e.g., 74% of accurate notes during 2024 US presidential election were hidden).
→ Bridging is promising but scale and division are challenges. Daimon is designed to avoid these by building from small shared axes.
- ✓ **Voelkel, Willer, et al. (2024, Science)**.
Mega-study (32,000 US participants / 25 interventions). Effective strategies include presenting empathetic figures from opposing sides, shared identity, correcting misperceptions. Effect diminishes after ~2 weeks → need for "daily experience design" rather than one-time intervention.
+ * Voelkel et al. (2023, Nat. Hum. Behav.): Reducing polarization does not necessarily improve anti-democratic attitudes.
- * Argyle et al. (2023). AI chat support can improve conversation quality on divisive topics. (Venue to be confirmed.)

---

## 8. Successful service examples (partial proof of design)

**Making perspectives (POV) first-class = Aspect-based review culture**
ErogameScape (original POV-DB for 20+ years) / Letterboxd (casual short reviews as social "reviews" / rapid growth) / RateYourMusic, Discogs / The StoryGraph (tags for mood & pace) / Untappd, Vivino, BeerAdvocate (multi-axial ratings) / MyAnimeList, AniList (tags + affinity%) / BoardGameGeek / Genius (line-by-line annotations = POV fragments).
→ "Overall rating" is less rich than "by perspective," both for writers and readers.

**Bridging / cross-approval = large-scale demonstration of daimon core**
Community Notes (bridging in practice) / Pol.is + vTaiwan (policy consensus) / Wikipedia (NPOV + collaborative editing).

**Structured & "deep but usable"**
Stack Overflow (Q&A to persistent knowledge) / Reddit (subreddits = axes) / Metaculus / Kialo.

**Beyond follow graphs: discovery via interest graphs / serendipity**
TikTok ("proof of more axes than others") / Pinterest (interest graph) / Spotify Discover Weekly / Are.na (cross-channel curation).

In one phrase:
ErogameScape's perspective decomposition × (Community Notes / Pol.is bridging) × (casual depth of Letterboxd) × (interest graph of TikTok) — integrated into a unified experience "connected by sensibility distance."

---

## 9. Philosophy / dialogue theory (background ideas)

* Bakhtin (1981, *The Dialogic Imagination*, polyphony) / * Habermas (1984, *Theory of Communicative Action*, deliberative rationality) / * Buber (1923, *I and Thou*, I and Thou).

---

## 10. One-paragraph summary (like in an interview)

Daimon is a counter-proposal to "SNS that streams subjective content as-is." It decomposes and accumulates subjectivity into shareable axes called "perspectives (POV)," arranging people and content by sensibility distance (Sense-Distance), and elevates the relationship of "seeing the same thing but feeling differently" (bridging). This transforms conflicts from flame wars into **learning and connection** rather than division.
It aligns with the directions shown collectively by Pol.is, bridging-based ranking, and the Habermas Machine, grounded in neuroscience (communication = brain synchronization / sensibility proximity = neural similarity / self-disclosure = reward / exploration = SEEKING) and interpersonal psychology (contact hypothesis / perspective listening / incremental self-disclosure / optimal differentiation), embedding individual discovery experiences.
All complexity is submerged underground, leaving only one gesture on the surface (Tesler's Law).