import ExpoModulesCore
import Photos
import UniformTypeIdentifiers

public final class StemcellsEdgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StemcellsEdge")

    View(StemcellsVeilView.self) {
      ViewName("Veil")
      Prop("edge") { (view: StemcellsVeilView, edge: String) in
        view.edge = edge == "bottom" ? .bottom : .top
      }
    }

    AsyncFunction("saveVideoToLibrary") { (url: URL, mimeType: String, name: String, promise: Promise) in
      Self.saveVideoToLibrary(url: url, mimeType: mimeType, name: name, promise: promise)
    }
  }

  // Add-only access: the app can put a video into Photos and can read nothing there.
  private static func saveVideoToLibrary(url: URL, mimeType: String, name: String, promise: Promise) {
    PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
      guard status == .authorized || status == .limited else {
        promise.reject("ERR_PHOTOS_DENIED", "Photos is off for this app. Turn it on in Settings, under Apps.")
        return
      }
      PHPhotoLibrary.shared().performChanges({
        let options = PHAssetResourceCreationOptions()
        options.uniformTypeIdentifier = UTType(mimeType: mimeType)?.identifier
        options.originalFilename = name
        // Photos copies the file, so the caller's temporary copy stays its own to delete.
        options.shouldMoveFile = false
        PHAssetCreationRequest.forAsset().addResource(with: .video, fileURL: url, options: options)
      }, completionHandler: { saved, error in
        if saved {
          promise.resolve(nil)
        } else if (error as NSError?)?.code == PHPhotosError.notEnoughSpace.rawValue {
          promise.reject("ERR_PHOTOS_FULL", "There isn't enough space on this phone to save the video.")
        } else {
          promise.reject("ERR_PHOTOS_REFUSED", "Photos can't keep this video. Share it instead.")
        }
      })
    }
  }
}
