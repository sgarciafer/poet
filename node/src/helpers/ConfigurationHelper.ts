import { assert } from 'poet-js'

export function validatePoetVersion(configuration: any) {
  assert('poetVersion' in configuration, 'Field poetVersion is missing')
  assert(Object.prototype.toString.call(configuration.poetVersion) == '[object Array]', 'Field poetVersion must be an Array')
  assert(configuration.poetVersion.length == 4, 'Field poetVersion must have 4 elements')

  configuration.poetVersion.forEach(function(element: number) {
    assert(Number.isInteger(element) && 0 <= element && element < 256, 'Each member of poetVersion must be a number between 0 and 255')
  });
}