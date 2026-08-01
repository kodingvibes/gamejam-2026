# Yhozen game direction

## Scope

Only create or modify files inside `participantes/yhozen/`. Do not change the
jam's root files or another participant's work.

## Git workflow

Always use [Conventional Commits](https://www.conventionalcommits.org/) for
commit messages, such as `feat: add skateboard acceleration` or
`fix: apply weapon recoil in the correct direction`.

## Core concept

This game is a multiplayer first-person shooter where every player rides a
skateboard. Movement should combine FPS controls with skateboard momentum,
turning, acceleration, and loss of speed.

## Physics and shooting

Physics should feel somewhat realistic while remaining readable and fun.
Preserve momentum and make forces interact consistently with the player's
current velocity.

Firing a weapon applies recoil to the player in the direction opposite to the
bullet. Depending on the direction of the shot relative to the skateboard's
movement, shooting can:

- Propel or accelerate the player.
- Slow the player down.
- Push the player sideways or change their trajectory.

Treat this recoil-based movement as a central mechanic, not merely a visual
effect. Weapons, maps, and multiplayer encounters should create opportunities
for players to use shooting both for combat and traversal.
