// おかんの見張りカメラ：内カメラで顔と目線を見て、気になることを1行ずつ知らせる
// near 画面に近すぎる / slouch 猫背 / yoso よそ見 / nemuri 居眠り
import AVFoundation
import Foundation
import Vision

// 引数1: 知らせを書き込むファイル　引数2: 近いと判断する顔の大きさ
let args = CommandLine.arguments
let logPath = args.count > 1 ? args[1] : "/tmp/okancam.log"
let nearSize = args.count > 2 ? (Double(args[2]) ?? 0.42) : 0.42
FileManager.default.createFile(atPath: logPath, contents: nil)
let logFile = FileHandle(forWritingAtPath: logPath)

func emit(_ line: String) {
  print(line)
  fflush(stdout)
  logFile?.seekToEndOfFile()
  logFile?.write("\(line)\n".data(using: .utf8)!)
}
let cooldown = 8.0

final class Watcher: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
  var lastCheck = 0.0
  var lastSaid: [String: Double] = [:]
  var streak: [String: Int] = [:]

  func say(_ word: String) {
    let now = Date().timeIntervalSince1970
    if now - (lastSaid[word] ?? 0) < cooldown { return }
    lastSaid[word] = now
    emit(word)
  }

  // 同じ状態が need 回続いたら true
  func hold(_ word: String, _ hit: Bool, need: Int = 3) -> Bool {
    streak[word] = hit ? (streak[word] ?? 0) + 1 : 0
    return (streak[word] ?? 0) >= need
  }

  // 目の開き具合（縦÷横）。小さいほど閉じている
  func openness(_ eye: VNFaceLandmarkRegion2D?) -> Double? {
    guard let pts = eye?.normalizedPoints, pts.count > 2 else { return nil }
    let xs = pts.map { Double($0.x) }
    let ys = pts.map { Double($0.y) }
    let w = (xs.max() ?? 0) - (xs.min() ?? 0)
    return w > 0 ? ((ys.max() ?? 0) - (ys.min() ?? 0)) / w : nil
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let now = Date().timeIntervalSince1970
    if now - lastCheck < 0.3 { return }
    lastCheck = now
    let request = VNDetectFaceLandmarksRequest()
    let handler = VNImageRequestHandler(cmSampleBuffer: sampleBuffer, options: [:])
    try? handler.perform([request])
    guard let face = request.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) else {
      if CommandLine.arguments.contains("debug") { emit("debug noface") }
      for word in ["near", "slouch", "yoso", "nemuri"] { _ = hold(word, false) }
      return
    }
    let box = face.boundingBox
    let yaw = abs(face.yaw?.doubleValue ?? 0)
    let pitch = face.pitch?.doubleValue ?? 0
    let left = openness(face.landmarks?.leftEye)
    let right = openness(face.landmarks?.rightEye)
    let eyes = [left, right].compactMap { $0 }
    let isClosed = !eyes.isEmpty && eyes.reduce(0, +) / Double(eyes.count) < 0.13

    if CommandLine.arguments.contains("debug") {
      emit(String(format: "debug w=%.2f y=%.2f yaw=%.2f pitch=%.2f eye=%.2f", box.width, box.midY, yaw, pitch, eyes.first ?? -1))
    }
    if hold("near", box.width > nearSize) { say("near") }
    if hold("slouch", box.midY < 0.22) { say("slouch") }
    if hold("yoso", yaw > 0.45, need: 4) { say("yoso") }
    if hold("nemuri", isClosed, need: 7) { say("nemuri") }
  }
}

let session = AVCaptureSession()
session.sessionPreset = .vga640x480
guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)
  ?? AVCaptureDevice.default(for: .video),
  let input = try? AVCaptureDeviceInput(device: device) else {
  FileHandle.standardError.write("no camera\n".data(using: .utf8)!)
  exit(1)
}
session.addInput(input)
let output = AVCaptureVideoDataOutput()
let watcher = Watcher()
output.setSampleBufferDelegate(watcher, queue: DispatchQueue(label: "okan"))
session.addOutput(output)
session.startRunning()
AVCaptureDevice.requestAccess(for: .video) { ok in emit(ok ? "ready" : "denied") }
RunLoop.main.run()
