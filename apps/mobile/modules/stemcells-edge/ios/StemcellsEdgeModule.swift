import ExpoModulesCore

public final class StemcellsEdgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StemcellsEdge")

    View(StemcellsVeilView.self) {
      ViewName("Veil")
      Prop("edge") { (view: StemcellsVeilView, edge: String) in
        view.edge = edge == "bottom" ? .bottom : .top
      }
    }
  }
}
