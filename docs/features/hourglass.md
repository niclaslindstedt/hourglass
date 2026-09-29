# The hourglass

The screen, and the whole app.

## What it shows

- **The glass.** Two bulbs in a frame, sand in one of them, and — while it
  runs — a stream through the waist, a funnel sinking in the upper bulb and a
  cone growing in the lower. The sand is modelled, not animated: what has run
  through is what the clock says has, and each heap lies at its own angle
  (see [`../design.md`](../design.md)). The frame and the light on the
  glass are pictures traced in Blender off the same measurements, with
  photographed wood and metal. Which glass it is — the frame, the
  shape, the sand — is yours to pick under **Settings → The hourglass** (see
  [`looks.md`](looks.md)).
- **Its size.** A longer glass is a bigger glass: a one-minute glass takes a
  little under half the height of the screen and a two-hour one all of it,
  on a log scale, so the step from one minute to two grows the glass more than
  the step from ninety to a hundred and twenty. The glass is centred, and
  nothing else on the screen moves when it changes.
- **The length**, for a moment, while it is being changed — the only figure
  on the screen. There is no countdown: the glass says how far along it is
  the way an hourglass does.
- **The light.** When the last of the sand is through, a soft glow comes up
  behind the glass, and the device buzzes if it can and the setting is on.
- **The cog**, floating in the corner: Settings. There is no bar over the
  glass, and no other button.

## What a gesture does

- **Tap** the glass, anywhere on it, and it turns over: the frame rotates
  half a turn, the heaps drop onto their new floors and the sand runs from the
  bulb now on top. A running glass turns over the same way, and what had run
  through is what is now left to run.
- **Drag** up or down on the glass and it becomes a longer or a shorter one,
  one length on the list per step: 1 to 10 minutes by the minute, then 15,
  20, 25, 30, 45, 60, 90 and 120. A new length is a new glass, standing with
  its sand run out. On a desk the wheel and the arrow keys do the same, and
  `Space` or `Enter` turns it over.
- **Turn the phone** over and the sand runs the other way, without the
  picture moving — it is the phone that moved, not the glass. The bulb that
  is now lower on the phone is the one the sand runs into, the stream runs
  up the screen, and a tap or a drag works exactly as before. The sensor
  decides which way is down with a wide margin either side of level, so a
  phone carried flat or laid on a table does not turn its glass at every
  jolt.
- **Tilt the phone** and the sand leans with it: the heaps settle to a
  surface that leans as the glass leans, and the stream falls at the slant
  and lands off the middle, where the cone then grows. Past sixty degrees
  — the glass on its side — the hole is no longer fed and the sand stops;
  stand it up and it goes on from where it was, the time it stood still
  not counted. Laying the phone flat on a table does not stop it: only the
  lean across the screen counts, so a glass on a desk keeps running.
- **Shake the phone** and the grains jump: the heaps slump flatter while
  it lasts, sand is thrown about on their surfaces, the dust on the walls
  leaps and the stream wavers — and it all settles back the moment the
  shaking stops. A shake changes nothing about the time. On a desk, a quick
  sideways wiggle of the pointer on the glass is the shake.

  All of it is under **Settings → The timer → Turn with the phone**; on an
  iPhone the motion sensors ask for permission the first time the glass is
  pressed, and every reading is used for the next frame and nothing else —
  never stored, never sent.

## Screen readers and keyboards

The glass is a button, named for what it is and what state it is in —
running, standing still, run out — with the instructions in its description.
The keyboard reaches everything a finger does.

## What is deliberately not here

A start button, a pause, a reset, a countdown, a second timer, a list of
recent lengths. Each has been asked for in some form and each is the thing an
hourglass is not: an hourglass is turned over, and that is all it can do.
