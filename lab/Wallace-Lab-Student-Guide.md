# Wallace Lab — student guide

Wallace Lab is a stereo instrument for composing with **variable reverberation**: making a sound travel through different rooms, on purpose.

You do not need Max, a mixer, or eight speakers. Open the lab in a browser, click **Enable audio**, and listen.

This guide explains every control. Read it once, then keep it beside the lab while you work.

---

## The idea in one minute

An **impulse response** (IR) is a recording of how a room answers a short sound — a clap, a starter pistol, a balloon. If you send your flute, voice, or a file through that recording (a process called **convolution**), the instrument sounds as if it were played in that room.

Wallace puts **four rooms** on a square. A black point moves among them.

There are two different ways to travel:

- **Mix** — you hear several rooms at once, like four auxiliary sends on a mixing desk. Near a number, that room is loud. In the centre, all four speak together.
- **Interpolate** — the lab builds **one hybrid room** that sits between the four. You do not hear a stack of spaces. You hear a single impossible space that changes as the point moves.

That is the experiment: *many rooms at once*, or *one room that changes species*.

---

## How to start

1. In a terminal: `cd lab` then `npm install` then `npm run dev`.
2. Open the address the terminal prints (usually `http://localhost:5173`).
3. Click **Enable audio**. The browser must hear a click before it will make sound.
4. Click **Fire**. You should hear a click with a tail — that is the current room answering.

If you hear nothing, raise **Master** and **Wet**, and make sure **Mute** is off.

---

## A first session (about ten minutes)

1. Leave the mode on **Mix**.
2. Source: **Impulse**. Click **Fire** a few times while you drag the black point. Notice how the tail changes near 1, 2, 3, 4, and in the middle.
3. Switch to **Interpolate**. Fire again on the same path. Ask: is this one room or several?
4. Click **A/B**. Stand still. Press **Space** to flip. Same point, two engines.
5. Source: **None** — silence. Then **Mic** or **File**, and play a short phrase.
6. Click **Record**, improvise, click **Stop**. A WAV file downloads. Drop it into a DAW.

---

## The square

The square is the main instrument, the same idea as the original Wallace patch.

| Number | Place on the square | Default room |
|---|---|---|
| 1 | Left | Tile room — short, bright |
| 2 | Top | Chamber — medium, neutral |
| 3 | Right | Hall — long, warm |
| 4 | Bottom | Nave — very long, dark |

The black point is “where you are.” Orange discs grow when that room is contributing more.

- Drag the point (when Transition is **Off**).
- The closer you are to a number, the more that room is used.
- The centre is a blend of all four.

---

## Modes (top right)

### Mix

Four convolutions run together. Their volumes follow the point. This is Wallace as a mixing desk.

Musically: rooms can **coexist**. You may hear a short bright tail and a long dark tail at the same time. The decay plot often shows **more than one slope**.

### Interpolate

One hybrid impulse response is rebuilt from the same point. The four rooms are melted into a single IR, then your sound goes through that.

Musically: you hear **one space changing**. The decay plot is usually a **single slope**.

### A/B

Same four rooms, same point. Press **Space** or **Flip A/B** to switch between Mix and Interpolate. Use this when you want to decide which engine is more interesting for a phrase — not when you want to move the point and listen in a leisurely way.

While A/B is on, dragging still moves the point.

---

## Transition and Rate

These sit under the square.

| Transition | What the point does |
|---|---|
| **Off (drag)** | You move it. Composition stays in your hand. |
| **Circular** | The point walks a circle, like Wallace’s sine movement. |
| **Rectilinear** | The point travels left–right through the middle. |
| **Random** | The point chooses a spot, glides there, chooses again. |

**Rate** is how fast that movement is. Slow rates (0.05–0.15) are easier to hear as *travel*. Fast rates turn the rooms into a texture.

Tip: start **Off**, learn the four corners, then let Circular or Random perform the travel while you play.

---

## Source

This is the sound that enters the rooms.

| Source | What it is | When to use it |
|---|---|---|
| **None** | Silence. Stops file, mic, noise, and pulse. | Rest, talk, change IRs, or wait for a tail to die. **Fire** does nothing. |
| **Impulse** | A single click when you press **Fire** (or Space, if not in A/B). | Hearing the room itself — the cleanest test. |
| **Noise** | A continuous noise bed. **Fire** sends a short burst. | Hearing how brightness and length change. |
| **Pulse** | A continuous sawtooth tone. | Hearing pitch inside the tail; beating and colour. |
| **File** | A sound file, looping. Use **Open file** or the File chip. | Testing a recorded phrase or a tape part. |
| **Mic** | The computer microphone, live. | Voice, instrument, improvisation. Grant permission when the browser asks. |

**Fire** — sends a test click (or a noise burst if Noise is selected). Does nothing on **None**.

**Open file** — choose an audio file without switching the chip first.

### Dry and Wet

- **Dry** — the source with no room. Keep it low (around 0.05) if you want to hear the spaces. Raise it if you need the instrument to stay present.
- **Wet** — the reverberated sound. This is the main voice of the lab.

Think of a performer in a hall: dry is “close to the player,” wet is “the hall answering.”

---

## Impulse responses (the four slots)

Each slot is one corner of the square.

For each slot you can:

- Choose a built-in room: **Tile room**, **Chamber**, **Hall**, **Nave**.
- **Load WAV** — use your own IR (a real hall, a church, a bathroom, something you recorded).

The built-in rooms are synthetic sketches, not measured halls. They are different enough to study travel. For a piece, load real IRs.

A useful first quartet: one short bright room, one medium, one long warm, one very long dark — the default set. Then replace them one by one and listen again.

---

## Interpolate menu

These settings only change the **Interpolate** (and B in A/B) engine. Mix always uses a straight volume blend.

| Method | What it does | How it tends to sound |
|---|---|---|
| **Early / late split** | The first milliseconds (attacks, first reflections) are mixed in time. The tail is morphed in the spectrum. | Attacks stay readable; the space behind them melts. Good default for voice and flute. |
| **Log-magnitude** | The whole IR is morphed by blending spectral energy on a logarithmic scale. | A stronger hybrid room. The “halfway” place often feels like a new architecture. |
| **Time mix (control)** | Weighted sum of the IR waveforms. Mathematically the same as Mix. | Use this to check the comparison. If Mix and Interpolate sound identical, you are probably on Time mix. |

**Early window** (10–120 ms) — how much of the start is treated as “early” in the split method. Around **40 ms** is a good start. Shorter keeps only the attack; longer starts to mix the beginning of the tail as well.

**Listen to hybrid IR** — plays the current resulting IR as if it were the sound itself, with no extra source. Use it to hear the room without a flute or file in the way.

---

## Record, Mute, Master

The transport bar is above the square.

### Record

Records what the **master** is making (dry + wet, Mix or Interpolate), not the raw microphone alone.

- Click **Record** (or press **R**). The button turns red.
- Play, drag, change modes.
- Click **Stop** (or **R** again). A **WAV** file downloads, named `wallace-lab-YYYYMMDD-HHMMSS.wav`.
- The take also stays as a link so you can download it again.

Import the WAV into a DAW like any other audio file (Ableton, Logic, Reaper, Pro Tools, etc.). It is mono, 16-bit, at the browser’s sample rate (often 44.1 or 48 kHz).

### Mute

Silences the **speakers** only. Recording continues. Use it if the room is loud, if you are recording with a microphone and getting feedback, or if you want to keep playing into the take without monitoring.

Mute is not **None**. None stops the source. Mute only closes the monitors.

### Master

The final level, after Dry and Wet. It affects both what you hear and what is recorded. Default is 0.90. If the take is quiet in the DAW, raise Master before you record again rather than boosting a noisy file later.

---

## The three pictures (Resulting IR)

These drawings show the room you are in, not the live waveform of your playing.

1. **Waveform** — the IR as a shape in time. A short room is a compact spike. A nave is a long decaying cloud.
2. **Schroeder decay** — how energy dies, in decibels. One straight-ish fall = one decay time. A broken or double slope often means **two rooms still present** (typical of Mix).
3. **Spectrogram** — time on the horizontal axis, frequency on the vertical. Bright rooms keep high frequencies in the tail. Dark rooms lose them quickly.

The line of numbers above the pictures (for example `1:70%  2:10%  3:8%  4:12%` and `RT60 ≈ 1.85 s`) is a snapshot: how much each slot is contributing, and a rough reverberation time of the resulting IR.

When you flip A/B, these pictures should change with the sound.

---

## Keyboard

| Key | Action |
|---|---|
| **R** | Start or stop recording |
| **M** | Mute or unmute the speakers |
| **Space** | In A/B: flip Mix / Interpolate. Otherwise: Fire (unless Source is None) |

If you are typing in a box or using a menu, the keys are ignored.

---

## Listening advice

These come from the original Wallace pieces and still help in the lab.

- **Voice** shows rooms more clearly than a smooth instrument. Speak, then play the same path on flute or saxophone.
- **Short contrasting gestures** (staccato / silence / a long tone) make the tail readable. A continuous tutti can hide the travel.
- **The real room you sit in** is a fifth IR you cannot switch off. Headphones make the virtual rooms easier to judge. Speakers put them back in dialogue with the hall — which is part of the piece, not a mistake.
- A **quiet background soundscape** (a file, low dry/wet) can make the virtual rooms stand out, as in *Variações sobre Espaço #2*.

---

## A few compositional questions

Use the lab to answer these, not to collect presets.

1. Do I want the audience to hear **several spaces at once**, or **one space becoming another**?
2. Should the point be **in my hands** (Off), or should it **perform** (Circular, Random)?
3. What happens if one slot is a real measured IR and the opposite slot is almost dry (a very short tile room)?
4. Is the phrase written so the tail has time to speak, or does the next attack cover it?
5. After A/B, which engine belongs to this material — and does the answer change in a real hall?

When something works, **Record** it. The WAV is the sketch. The square settings are the score of the space.

---

## If something is wrong

| Problem | Try this |
|---|---|
| No sound at all | Enable audio again. Unmute. Raise Master and Wet. Source not on None. |
| Only a click, no room | Raise Wet. Drag away from a very short IR. Check that IRs are loaded. |
| Mic is silent | Allow microphone permission. Check the system input. |
| Mic howls | Mute the speakers, use headphones, or lower Master. |
| Mix and Interpolate sound the same | Set Method to Early / late split or Log-magnitude, not Time mix. Stand between two very different rooms. |
| Recording is empty | Do not use Source **None** for the whole take unless you only wanted silence. Watch the timer. |
| File will not load | Use a common format (WAV, AIFF, MP3). Very long IRs are trimmed to a few seconds. |

---

Wallace Lab is a studio for the question Wallace was built to ask: how do we compose when reverberation will not stay still? The menus are only there so you can ask that question with your ears.
