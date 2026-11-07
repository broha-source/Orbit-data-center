# Demo site update brief — AI-Generated Radiator Flow Path

You are updating an existing demo website. The site already exists. **Keep its design, layout, typography and dark theme.** Change only the content, numbers, images and the generator's behaviour described below.

The site still shows an early version of the research: 256 samples per family, a 25,000-tile dataset, and Serpentine at 81.6%. This folder contains the final results. Take every number from `data/results.json` and do not invent or round values differently.

---

## 0. Folder contents

| Path | What it is |
|---|---|
| `data/results.json` | Pass rates for all 4 model stages × 5 families, failure reasons, the Serpentine pass-count analysis, and dataset/sampler facts. |
| `data/samples_manifest.json` | One entry per sample image: family, pass count (Serpentine only), channel width, volume fraction, and paths to the CAD and SDF images. Also lists the 5 QC-card images. |
| `images/samples/<family>/` | Final-model generated tiles that passed every gate. Each tile has `*_cad.png` (black channel on white) and `*_sdf.png` (grayscale distance field), both 512×512.<br>• Serpentine: 50 tiles, 10 for each pass count 5 / 7 / 9 / 11 / 13.<br>• Each of the other four families: 30 tiles. |
| `images/qc_cards/<family>.png` | One representative tile per family for the quality-control cards. |
| `images/workflow/` | Explanatory figures (see section 4). |

Family keys: `serpentine`, `parallel`, `pin`, `spiral`, `spider_web`. Display names are Serpentine, Parallel, Pin, Spiral, Spider Web.

---

## 1. Generator panel (top section)

- **Family buttons:** keep them as they are.
- **GENERATE NEXT DESIGN:** the site does not run a model. The button shows the next image from `samples_manifest.json` for the selected family.
  - Cycle through the samples in a shuffled order.
  - Never show the same sample twice in a row.
- **PASS COUNT control:**
  - Show it **only when Serpentine is selected**. It is the extra condition added only for Serpentine.
  - Make it a discrete selector with exactly 5 values: **5, 7, 9, 11, 13 passes**. Only odd counts exist because the inlet and outlet sit on opposite sides of the tile.
  - Remove "Move freely across the learned design range". Replace it with: "Odd pass counts only — the inlet and outlet sit on opposite sides."
  - Changing the value shows a sample with that `pass_count`.
- **REPRESENTATION SDF / CAD:** switch between the `sdf` and `cad` image of the same sample.
- **GEOMETRY ESTIMATE panel:** keep the site's existing estimation method and units. The new images are the same 256-px tiles upscaled to 512 px. No physical scale is supplied here, so do not invent one.

---

## 2. GENERATION QUALITY CONTROL cards

Replace the five cards with the final-model values from the `final` stage in `results.json`.

| Family | Big number | Sub-line |
|---|---|---|
| Serpentine | 99.3% | 993 / 1,000 PASS |
| Parallel | 98.0% | 980 / 1,000 PASS |
| Pin | 100% | 1,000 / 1,000 PASS |
| Spiral | 97.2% | 972 / 1,000 PASS |
| Spider Web | 99.6% | 996 / 1,000 PASS |

- Add an overall line above or below the cards: **98.8% overall (4,941 / 5,000)**.
- Card images: `images/qc_cards/<family>.png`.
- **Card bullets:**
  - Use the top 2–3 entries of `fail_reasons` for that family.
  - Write them as "N × <reason>", for example "6 × disconnected channel".
  - Title the bullet list "Failure flags". One tile can carry more than one flag, so the flags can add up to more than the number of failed tiles.
  - For Pin, write "No gate failures".
- Change "RAW PASS" to "PASS". Generated per family is 1,000, not 256.

---

## 3. DIFFUSION WORKFLOW, STEP BY STEP

Update the step texts. A fifth step for the adapter is optional; if you keep four steps, merge it into step 02.

**01 PREPARE — Build the SDF dataset**
2,000 SDF tiles per family × 5 families = 10,000 training geometries. Each tile is 256 × 256. The value is the signed distance to the channel wall: positive inside the channel, negative outside.
Replace "5 × 5,000" with "5 × 2,000".

**02 TRAIN — One conditional model**
- One conditional diffusion U-Net learns all five families. The condition is family + channel width, and it is fed to every layer.
- Training runs for 50 epochs.
- The loss is weighted so the model focuses on what matters:
  - **Boundary Weighting:** pixels near any channel wall count up to 5× more.
  - **Corner·Thickness Weighting:** for Serpentine and Spiral, sharp corners and thin walls count up to 13×.

**03 ADAPT — Pass-Count Conditioning (Serpentine only)** — new step
- The trained model is frozen. A small add-on condition tells it how many passes to draw (5–13).
- The add-on is trained on 2,000 Serpentine tiles only.
- It is switched on only when the family is Serpentine. For the other four families the output is identical to the frozen model.

**04 GENERATE — Turn noise into an SDF**
DDIM sampling with 100 denoising steps instead of 1,000, with no retraining needed. Generating 1,000 tiles per family (5,000 in total) takes about 80 minutes. Use `images/workflow/denoise_*.png` (xT → xt → x0) as the step strip.

**05 VERIFY — Threshold, then gate**
SDF > 0 becomes the fluid mask. Automatic gates check connectivity from inlet to outlet, minimum wall thickness and channel structure, and report PASS or FAIL. The gates only judge results and do not influence generation. CFD/CHT remains a separate validation step.

---

## 4. New section: "HOW WE GOT TO 98.8%"

Add a section with a 4-stage stepper or bar chart. Take the values from the `stages` array in `results.json`:

| Stage | Serpentine | Parallel | Pin | Spiral | Spider Web | Overall |
|---|---|---|---|---|---|---|
| Baseline | 70.0 | 98.6 | 99.9 | 56.3 | 96.2 | 84.2 |
| + Boundary Weighting | 91.0 | 99.0 | 99.9 | 94.3 | 99.6 | 96.8 |
| + Corner·Thickness | 80.8 | 98.0 | 100.0 | 97.2 | 99.6 | 95.1 |
| + Pass-Count Conditioning (final) | 99.3 | 98.0 | 100.0 | 97.2 | 99.6 | 98.8 |

Each stage gets one sentence and one figure from `images/workflow/`:

1. **Baseline**
   - Text: Serpentine and Spiral often break or merge channels.
   - Figure: `five_families.png`.
2. **Boundary Weighting**
   - Text: the loss counts pixels near channel walls 5× more, which brings Spiral from 56% to 94%.
   - Figure: `boundary_weight_zoom.png`.
3. **Corner·Thickness Weighting**
   - Text: extra weight on sharp corners and thin walls brings Spiral to 97.2%, but Serpentine drops to 80.8%.
   - Figures: `corner_thickness_*_before.png` / `_after.png`. "Before" is the uniform boundary weighting; "after" is the corner·thickness weighting, where dark red marks the extra weight.
4. **Why Serpentine dropped**
   - Text:
     - Training Serpentines only have odd pass counts, but the model was never told the pass count, so it sometimes drew even counts or misplaced turns.
     - 163 of 192 failures had a wrong pass structure.
     - Even-count tiles failed 64.5% of the time, against 13.6% for odd-count tiles.
   - Figures: `pass_count_train_odd.png` vs `pass_count_generated_even_fail.png`. In the second image, red highlights the part where the pass structure goes wrong.
5. **Pass-Count Conditioning**
   - Text: telling the model the pass count raises Serpentine to 99.3%. The other families are unchanged.

`unet.png` can illustrate the model wherever the site explains the U-Net.

---

## 5. Rules

- Every number must come from `data/results.json` or this brief. If something is missing, leave it out; do not estimate it.
- Use the family names exactly as written: Serpentine, Parallel, Pin, Spiral, Spider Web.
- Use the method names exactly as written: Boundary Weighting, Corner·Thickness Weighting, Pass-Count Conditioning.
- Use "pass", not "path", for one straight run of a Serpentine.
- All sample images are real generated outputs that passed the gates. Do not edit, crop or retouch them.
