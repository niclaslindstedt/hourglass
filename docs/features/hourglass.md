# The hourglass

The screen, and the whole app.

## What it shows

- **The glass.** Two bulbs in a frame, sand in one of them, and — while it
  runs — a stream through the waist, a funnel sinking in the upper bulb and a
  cone growing in the lower. The sand is modelled, not animated: what has run
  through is what the clock says has, and each heap lies at its own angle,
  slumps when it is fed past it, and flies when it is thrown (see
  [`../design.md`](../design.md)). The glass is drawn in three dimensions —
  real glass, turned wood and metal, lit by the sky behind it and reflecting
  it. Which glass it is — the frame, the shape, the sand — is yours to pick
  under **Settings → The hourglass** (see [`looks.md`](looks.md)). Where the
  device cannot draw in 3D, the same glass is painted flat.
- **The sky**, behind the glass and lighting it. By default it is the sky
  outside at this moment: the sun or the moon where they stand, as bright
  as the hour, the season and the place make it — a pale low light at a
  northern winter noon, gold at sunset, dark at night but for the moon and
  the stars. The place is read from the device's time zone (the city it is
  named for), never asked for and never sent. **Settings → The sky** has it
  as **Now**, or fixed as **Day**, **Dusk** or **Night**.
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
  glass, and no other button. With the phone held upside down the cog fades
  out of its corner and back in at the opposite one — the top right as the
  phone is now held — turned to read the right way up; the length, while it
  shows, moves and turns the same way.
- **A new version**, on the website: when one has landed, a small circling
  arrow beside the cog, as quiet as the cog is. Tap it and the page reloads
  onto the new version with the sand where it was. Settings → About can
  check now instead of waiting.

## What a gesture does

- **Tap** the glass, anywhere on it, and it turns over: the frame rotates
  half a turn, the sand held where it is while it turns, then drops to its
  new floor, lands and runs from the bulb now on top. A running glass turns
  over the same way, and what had run through is what is now left to run.
- **Drag** up or down on the glass and it becomes a longer or a shorter one,
  one length on the list per step: 1 to 10 minutes by the minute, then 15,
  20, 25, 30, 45, 60, 90 and 120. A new length is a new glass, standing with
  its sand run out. On a desk the wheel and the up and down arrow keys do the
  same, and `Space` or `Enter` turns it over.
- **Drag sideways** and the glass turns about its own axis, to see the sand
  from another side; let go and it spins on, slows and comes back to face
  you. The left and right arrow keys nudge it. On a desk, where there is no
  phone to shake, a quick sideways flick is the shake: the jerk pushes the
  sand.
- **Turn the phone** over and the sand falls to the other end and runs the
  other way, without the picture moving — it is the phone that moved, not
  the glass. The bulb that is now lower on the phone is the one the sand
  runs into, the stream runs up the screen, and a tap or a drag works
  exactly as before. The sky stays level with the world, so it is the right
  way up to you. The sensor decides which way is down with a wide margin
  either side of level, so a phone carried flat does not turn its glass at
  every jolt.
- **Tilt the phone** and the sand leans with it — to either side, or, leaned
  back or forward, to the back or the front of the bulb: the heaps slide
  that way. The stream bends toward the slant, meets the glass just under
  the waist, and runs down the inside of it as a rivulet — as sand on glass
  does — to the heap's edge on the downhill side, where the cone then
  grows. The view turns too, like a window: the horizon
  behind the glass stays level with the real one, and the sun and the moon
  stay where they are outside. Past sixty degrees to a side — the glass on
  its side — the hole is no longer fed and the sand stops; stand it up and
  it goes on from where it was, the time it stood still not counted. Laying
  the phone flat on a table does not stop it: the sand leans all the way to
  the back of the bulb and the glass keeps running.
- **Swing the phone** and the glass swings a little behind it, the way a
  heavy thing held in a hand does: a quick turn shows you a hair of its
  side, and it catches up, swings a touch past and settles.
- **Shake the phone** and the sand moves: a jerk toward the end it rests on
  throws the top of the heap into the air, the grains hit the glass and land
  again, and while the shaking lasts the heaps slump flatter — and it all
  settles the moment it stops. A shake changes nothing about the time.
- **Feel it.** On a phone that can buzz (Android; an iPhone's Safari cannot),
  the sand hitting the glass is felt in the hand — a tick for a shake's
  handful, a thud for a whole heap landing after a turn. **Settings → The
  timer → Feel the sand** turns it off.

  All of the phone's part is under **Settings → The timer → Turn with the
  phone**. On an iPhone the motion sensors ask for permission the first time
  the glass is tapped (or the setting is switched on) — Safari grants it only
  at the end of a tap. Every reading is used for the next frame and nothing
  else — never stored, never sent.

## Screen readers and keyboards

The glass is a button, named for what it is and what state it is in —
running, standing still, run out — with the instructions in its description.
The keyboard reaches everything a finger does.

## What is deliberately not here

A start button, a pause, a reset, a countdown, a second timer, a list of
recent lengths. Each has been asked for in some form and each is the thing an
hourglass is not: an hourglass is turned over, and that is all it can do.
