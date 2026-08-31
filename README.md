# gameDrive

A web-based car racing game that uses your device's camera as the controller. Control your car with hand gestures and compete for the best lap times.

## Features

- Hand Gesture Control - Use your hands to steer the car via camera input
- Racing Gameplay - Navigate tracks and complete races
- Camera Integration - Real-time hand tracking using your device's camera
- Web-Based - Play directly in your browser, no installation needed
- Multi-Device Support - Works on desktop, tablet, and mobile devices with cameras

## How to Play

1. Visit [gameDrive](https://heysanzu.github.io/gameDrive/)
2. Allow camera access when prompted
3. Position your hands in front of the camera
4. Move your hands left and right to steer the car
5. Navigate the track and complete the race

## Controls

- Left Hand Movement - Steer car left
- Right Hand Movement - Steer car right
- Both Hands Together - Accelerate forward

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Device with a working camera/webcam
- Good lighting conditions for optimal hand detection

### Installation

1. Clone the repository:
```bash
git clone https://github.com/heysanzu/gameDrive.git
cd gameDrive
```

2. Open `index.html` in your web browser or serve it locally:
```bash
python -m http.server 8000
```

3. Navigate to `http://localhost:8000` and start playing

## Technologies Used

- HTML5 - Game structure and markup
- TensorFlow.js & MediaPipe - Hand gesture recognition
- Canvas API - Game rendering
- WebRTC - Camera access

## Contributing

Contributions are welcome. Feel free to report bugs, suggest features, or submit pull requests.

## License

This project is open source and available under the MIT License.

## Author

[heysanzu](https://github.com/heysanzu)

## Support

If you encounter any issues, check the [GitHub Issues](https://github.com/heysanzu/gameDrive/issues) or create a new one.
