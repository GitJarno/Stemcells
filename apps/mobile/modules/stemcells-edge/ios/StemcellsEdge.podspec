Pod::Spec.new do |s|
  s.name           = 'StemcellsEdge'
  s.version        = '1.0.0'
  s.summary        = 'The phone edges where the page slides under the chrome.'
  s.description    = 'A progressive blur under the header and the composer.'
  s.author         = 'Stemcells'
  s.homepage       = 'https://stemcells.sh'
  s.platforms      = {
    :ios => '18.0',
  }
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
  s.source_files = '**/*.swift'
end
