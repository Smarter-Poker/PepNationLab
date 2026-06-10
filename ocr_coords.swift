import Vision
import AppKit

let url = URL(fileURLWithPath: "/Users/smarter.poker/Downloads/PEPTIDE GLOSSARY.png")
guard let image = NSImage(contentsOf: url),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("Failed to load image")
    exit(1)
}

let height = CGFloat(cgImage.height)

let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNRecognizeTextRequest { request, error in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    for observation in observations {
        if let topCandidate = observation.topCandidates(1).first {
            let bbox = observation.boundingBox
            // bbox is normalized coordinates from bottom left
            let yCenter = height - (bbox.origin.y + bbox.size.height / 2) * height
            print("\(Int(yCenter)): \(topCandidate.string)")
        }
    }
}
request.recognitionLevel = .accurate
try? requestHandler.perform([request])
