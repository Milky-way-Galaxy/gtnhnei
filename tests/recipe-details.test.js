import {test} from "node:test";
import assert from "node:assert/strict";
import {recipeMetadataRows} from "../recipe-details.js";
test("metadata retains exact exported values and distinguishes special/conflict fields from recipe metadata",()=>{
  const record={metadata:[{key:"coil_heat",value:5400},{key:"cleanroom",value:0}],specialValue:5400,circuitConflicts:2};
  assert.deepEqual(recipeMetadataRows(record),[{key:"coil_heat",value:5400},{key:"cleanroom",value:0},{key:"GT special value",value:5400},{key:"Circuit conflicts",value:2}]);
  assert.equal(record.metadata.length,2);assert.deepEqual(recipeMetadataRows(null),[]);
});
