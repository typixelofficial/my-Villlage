# TYPIXEL OPEN WORLD — Green Valley (3D Multiplayer)

A browser-playable 3D multiplayer open-world life simulation set in an expansive **840m × 840m Green Valley**, built with React, TypeScript, Three.js, Rapier 3D Physics, Express, Socket.IO, and Firebase Authentication & Cloud Firestore.

## Key Features
- **Automatic Firebase Wiring**: Pre-provisioned via `firebase-applet-config.json` with zero manual API key forms.
- **Sign In, Sign Up & Admin Login**:
  - **Google Sign-In** & **Email/Password Sign-In / Sign-Up** (with Instagram ID `@handle` prompt).
  - **Admin Studio Login** via the bootstrapped owner Google account or server-verified Admin Passcode (`ADMIN_PASSCODE` env secret or first-run scrypt claim).
- **840m × 840m Expanded Green Valley**: Long 700m Grand Highways, Sunset Valley Home Plots, Emerald Grand Overlook, Oakwood Residential, Commercial District, Lakeside Beach & Water Park, Sports Complex, Civic Hospital & Campus, and Valley Airport.
- **Custom 3D Home Builder & Admin Home Studio**:
  - Any player can build custom 3D homes (`Cabin`, `Modern`, `Villa`, `Manor`) anywhere in Green Valley using Green Coins.
  - Admins can construct custom 3D homes for any online or named player for free, manage homes, and grant Green Coins.
- **Works & Rewards Economy**: Complete repeatable Valley Jobs (`Works`) and claim resident `Rewards` (including Daily Check-In and Instagram Profile Bonus) to earn Green Coins.
- **Walk-Up Only Vehicles**: Walk physically up to any vehicle and press `E` to ride free bicycles or spend Green Coins to rent or permanently unlock cars, motorcycles, SUVs, and the SkyCab Aero Taxi.
- **Instagram IDs Everywhere**: Displayed on player HUD, floating 3D multiplayer nameplates, custom home yard signs, Friends directory, and Admin player list.

## Firebase Console Notes
1. Google Sign-In is ready immediately via `firebase-applet-config.json`.
2. To allow **Email/Password** Sign-In and Sign-Up alongside Google, enable **Authentication → Sign-in method → Email/Password** in your Firebase Console.
3. Optional: Set `ADMIN_PASSCODE` in your server environment secrets to lock Admin Passcode login to a fixed secret (otherwise, the first admin to claim a passcode sets it for the running server).
