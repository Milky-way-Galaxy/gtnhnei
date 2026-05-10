import { RecipeIoType, Repository } from "./repository.js";
import { SolvePage } from "./solver.js";
import { singleBlockMachine } from "./machines.js";
import { SearchQuery } from "./searchQuery.js";
let nextIid = 0;
export class ModelObjectVisitor {
    VisitArray(parent, key, array) {
        for (const obj of array) {
            this.VisitObject(parent, key, obj);
        }
    }
}
class ModelObjectSerializer extends ModelObjectVisitor {
    constructor() {
        super(...arguments);
        this.stack = [];
        this.current = {};
    }
    VisitData(parent, key, data) {
        this.current[key] = data;
    }
    VisitObject(parent, key, obj) {
        this.stack.push(this.current);
        this.current = {};
        obj.Visit(this);
        let result = this.current;
        this.current = this.stack.pop();
        this.current[key] = result;
    }
    VisitArray(parent, key, array) {
        var arr = [];
        this.stack.push(this.current);
        for (const obj of array) {
            this.current = {};
            obj.Visit(this);
            arr.push(this.current);
        }
        this.current = this.stack.pop();
        this.current[key] = arr;
    }
    Serialize(obj) {
        this.current = {};
        obj.Visit(this);
        return this.current;
    }
}
export class ModelObjectValidator extends ModelObjectVisitor {
    constructor() {
        super(...arguments);
        this.errors = {};
    }
    ValidationError(errorType) {
        this.errors[errorType] = (this.errors[errorType] || 0) + 1;
    }
    VisitData(parent, key, data) { }
    VisitObject(parent, key, obj) {
        if (obj instanceof RecipeModel) {
            let recipe = Repository.current.GetById(obj.recipeId);
            if (!recipe) {
                this.ValidationError("missingRecipe");
            }
            else if (obj.recipeId !== recipe.id) {
                this.ValidationError("changedRecipe");
            }
        }
        obj.Visit(this);
    }
    Validate(obj) {
        this.errors = {};
        obj.Visit(this);
        return this.errors;
    }
}
class ModelObjectIidScanner extends ModelObjectVisitor {
    constructor() {
        super(...arguments);
        this.iid = 0;
        this.result = null;
        this.resultParent = null;
    }
    VisitData(parent, key, data) { }
    VisitObject(parent, key, obj) {
        if (this.result !== null)
            return;
        if (obj.iid === this.iid) {
            this.result = obj;
            this.resultParent = parent;
            return;
        }
        obj.Visit(this);
    }
    Scan(obj, parent, iid) {
        if (obj.iid === iid) {
            return { current: obj, parent: parent };
        }
        this.result = null;
        this.iid = iid;
        obj.Visit(this);
        return this.result === null || this.resultParent === null ? null : { current: this.result, parent: this.resultParent };
    }
}
let serializer = new ModelObjectSerializer();
export { serializer };
let iidScanner = new ModelObjectIidScanner();
export function GetByIid(iid) {
    return iidScanner.Scan(page, page, iid);
}
export class ModelObject {
    constructor() {
        this.iid = nextIid++;
    }
}
export class FlowInformation {
    constructor() {
        this.input = {};
        this.output = {};
        this.energy = {};
    }
    Add(goods, amount, isOutput) {
        if (isOutput) {
            this.output[goods.id] = (this.output[goods.id] || 0) + amount;
        }
        else {
            this.input[goods.id] = (this.input[goods.id] || 0) + amount;
        }
    }
    Merge(other) {
        for (const key in other.input) {
            if (other.input[key] === 0)
                continue;
            this.input[key] = (this.input[key] || 0) + other.input[key];
        }
        for (const key in other.output) {
            if (other.output[key] === 0)
                continue;
            this.output[key] = (this.output[key] || 0) + other.output[key];
        }
        for (const key in other.energy) {
            if (other.energy[key] === 0)
                continue;
            this.energy[key] = (this.energy[key] || 0) + other.energy[key];
        }
    }
}
export var LinkAlgorithm;
(function (LinkAlgorithm) {
    LinkAlgorithm[LinkAlgorithm["Match"] = 0] = "Match";
    LinkAlgorithm[LinkAlgorithm["Ignore"] = 1] = "Ignore";
    //AtLeast,
    //AtMost,
})(LinkAlgorithm || (LinkAlgorithm = {}));
let emptyFlow = new FlowInformation();
export class RecipeGroupEntry extends ModelObject {
    constructor() {
        super(...arguments);
        this.flow = emptyFlow;
    }
}
export class RecipeGroupModel extends RecipeGroupEntry {
    Visit(visitor) {
        visitor.VisitData(this, "type", "recipe_group");
        visitor.VisitData(this, "links", this.links);
        visitor.VisitArray(this, "elements", this.elements);
        visitor.VisitData(this, "collapsed", this.collapsed);
        visitor.VisitData(this, "name", this.name);
    }
    constructor(source = undefined) {
        super();
        this.links = {};
        this.actualLinks = {};
        this.elements = [];
        this.collapsed = false;
        this.name = "Group";
        if (source instanceof Object) {
            if (source.links instanceof Object)
                this.links = source.links;
            if (source.elements instanceof Array)
                this.elements = source.elements.map((element) => {
                    if (element.type === "recipe")
                        return new RecipeModel(element);
                    else
                        return new RecipeGroupModel(element);
                });
            if (source.collapsed === true)
                this.collapsed = true;
            if (typeof source.name === "string")
                this.name = source.name;
        }
    }
}
export class RecipeModel extends RecipeGroupEntry {
    Visit(visitor) {
        visitor.VisitData(this, "type", this.type);
        visitor.VisitData(this, "recipeId", this.recipeId);
        visitor.VisitData(this, "voltageTier", this.voltageTier);
        visitor.VisitData(this, "crafter", this.crafter);
        visitor.VisitData(this, "choices", this.choices);
        visitor.VisitData(this, "fixedCrafterCount", this.fixedCrafterCount);
    }
    constructor(source = undefined) {
        super();
        this.type = "recipe";
        this.recipeId = "";
        this.voltageTier = 0;
        this.choices = {};
        this.recipesPerMinute = 0;
        this.crafterCount = 0;
        this.overclockFactor = 1;
        this.powerFactor = 1;
        this.parallels = 0;
        this.overclockTiers = 0;
        this.selectedOreDicts = {};
        this.machineInfo = singleBlockMachine;
        this.multiblockCrafter = null;
        this.recipeItems = [];
        if (source instanceof Object) {
            if (typeof source.recipeId === "string")
                this.recipeId = source.recipeId;
            if (typeof source.voltageTier === "number")
                this.voltageTier = source.voltageTier;
            if (typeof source.crafter === "string")
                this.crafter = source.crafter;
            if (source.choices instanceof Object)
                this.choices = source.choices;
            if (typeof source.fixedCrafterCount === "number")
                this.fixedCrafterCount = source.fixedCrafterCount;
        }
    }
    ValidateChoices(machineInfo, recipe) {
        var _a, _b;
        if (!machineInfo.choices) {
            this.choices = {};
            return;
        }
        const validatedChoices = {};
        for (const [key, choice] of Object.entries(machineInfo.choices)) {
            const currentValue = this.choices[key];
            const typedChoice = choice;
            const min = (_a = typedChoice.min) !== null && _a !== void 0 ? _a : 0;
            let max = (_b = typedChoice.max) !== null && _b !== void 0 ? _b : Number.POSITIVE_INFINITY;
            if (typedChoice.choices)
                max = typedChoice.choices.length - 1;
            validatedChoices[key] = Math.min(Math.max(currentValue !== null && currentValue !== void 0 ? currentValue : min, min), max);
        }
        if (machineInfo.enforceChoiceConstraints)
            machineInfo.enforceChoiceConstraints(recipe, validatedChoices);
        this.choices = validatedChoices;
    }
    getInputCount() {
        return this.recipeItems.filter((entry) => entry.type in [RecipeIoType.FluidInput, RecipeIoType.ItemInput, RecipeIoType.OreDictInput]).length;
    }
    getOutputCount() {
        return this.recipeItems.length - this.getInputCount();
    }
    getItemInputCount() {
        return this.recipeItems.filter((entry) => entry.type in [RecipeIoType.ItemInput, RecipeIoType.OreDictInput]).length;
    }
}
export class ProductModel extends ModelObject {
    Visit(visitor) {
        visitor.VisitData(this, "goodsId", this.goodsId);
        visitor.VisitData(this, "amount", this.amount);
    }
    constructor(source = undefined) {
        super();
        this.amount = 1;
        this.goodsId = "";
        if (source instanceof Object) {
            if (typeof source.goodsId === "string")
                this.goodsId = source.goodsId;
            if (typeof source.amount === "number")
                this.amount = source.amount;
        }
    }
}
export class PageModel extends ModelObject {
    Visit(visitor) {
        visitor.VisitData(this, "name", this.name);
        visitor.VisitArray(this, "products", this.products);
        visitor.VisitObject(this, "rootGroup", this.rootGroup);
        visitor.VisitData(this, "settings", this.settings);
    }
    constructor(source = undefined) {
        super();
        this.name = "New Page";
        this.products = [];
        this.rootGroup = new RecipeGroupModel();
        this.history = [];
        this.MAX_HISTORY = 50;
        this.status = "not solved";
        this.settings = { minVoltage: 0, timeUnit: "min" };
        this.timeScale = 1;
        this.loadFromObject(source);
    }
    loadFromObject(source) {
        if (source instanceof Object) {
            if (typeof source.name === "string")
                this.name = source.name;
            if (source.products instanceof Array)
                this.products = source.products.map((product) => new ProductModel(product));
            if (source.rootGroup instanceof Object)
                this.rootGroup = new RecipeGroupModel(source.rootGroup);
            if (source.settings instanceof Object) {
                if (typeof source.settings.minVoltage === "number")
                    this.settings.minVoltage = source.settings.minVoltage;
                if (typeof source.settings.timeUnit === "string")
                    this.settings.timeUnit = source.settings.timeUnit;
            }
        }
    }
    // Undo history methods
    addToHistory(json) {
        this.history.push(json);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }
    undo() {
        if (this.history.length > 1) {
            this.history.pop(); // Remove current state
            const previousState = this.history[this.history.length - 1];
            try {
                this.loadFromObject(JSON.parse(previousState));
                SolvePage(this);
                return true;
            }
            catch (e) {
                console.error("Failed to undo:", e);
            }
        }
        return false;
    }
}
function SearchGroup(query, group, idMap) {
    for (let element of group.elements) {
        if (element instanceof RecipeGroupModel) {
            SearchGroup(query, element, idMap);
        }
        else if (element instanceof RecipeModel) {
            if (!element.recipe)
                continue;
            for (let item of element.recipe.items) {
                if (item.goods.id in idMap)
                    continue;
                idMap[item.goods.id] = item.goods.MatchSearchText(query);
            }
        }
    }
}
export function Search(text) {
    let result = {};
    let query = new SearchQuery(text);
    SearchGroup(query, page.rootGroup, result);
    return result;
}
export function DragAndDrop(sourceIid, targetIid) {
    if (sourceIid === targetIid)
        return;
    var draggingObject = GetByIid(sourceIid);
    if (draggingObject === null || !(draggingObject.parent instanceof RecipeGroupModel) || !(draggingObject.current instanceof RecipeGroupEntry))
        return;
    var targetObject = GetByIid(targetIid);
    if (targetObject === null || !(targetObject.current instanceof RecipeGroupEntry))
        return;
    if (draggingObject.current instanceof RecipeGroupModel && !draggingObject.current.collapsed)
        return;
    console.log("DragAndDrop", draggingObject, targetObject);
    let success = false;
    if (targetObject.current instanceof RecipeGroupModel && !targetObject.current.collapsed) {
        draggingObject.parent.elements.splice(draggingObject.parent.elements.indexOf(draggingObject.current), 1);
        targetObject.current.elements.push(draggingObject.current);
        success = true;
    }
    else if (targetObject.parent instanceof RecipeGroupModel) {
        draggingObject.parent.elements.splice(draggingObject.parent.elements.indexOf(draggingObject.current), 1);
        var index = targetObject.parent.elements.indexOf(targetObject.current);
        if (index === -1)
            return;
        targetObject.parent.elements.splice(index, 0, draggingObject.current);
        success = true;
    }
    if (success) {
        UpdateProject();
    }
}
const changeListeners = [];
export let page;
export function addProjectChangeListener(listener) {
    changeListeners.push(listener);
}
export function removeProjectChangeListener(listener) {
    const index = changeListeners.indexOf(listener);
    if (index > -1) {
        changeListeners.splice(index, 1);
    }
}
function notifyListeners() {
    changeListeners.forEach(listener => listener());
}
export function SetCurrentPage(newPage) {
    console.log("SetCurrentPage", newPage);
    page = newPage;
    UpdateProject();
}
export function UpdateProject(visualOnly = false) {
    if (!visualOnly)
        SolvePage(page);
    notifyListeners();
    // workaround to getting empty recipes on first solve
    if (!visualOnly)
        SolvePage(page);
    notifyListeners();
}
async function GetUrlHashFromJson(json) {
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const compressedStream = new CompressionStream('deflate');
    const writer = compressedStream.writable.getWriter();
    writer.write(data);
    writer.close();
    const compressedBytes = await new Response(compressedStream.readable).arrayBuffer();
    const compressed = String.fromCharCode(...new Uint8Array(compressedBytes));
    const base64 = btoa(compressed).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return base64;
}
export async function CopyCurrentPageUrl() {
    const serialized = serializer.Serialize(page);
    const jsonString = JSON.stringify(serialized);
    const hash = await GetUrlHashFromJson(jsonString);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    await navigator.clipboard.writeText(url);
}
export function DownloadCurrentPage() {
    const serialized = serializer.Serialize(page);
    const prettyJson = JSON.stringify(serialized, null, 2);
    const blob = new Blob([prettyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.name}.gtnh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
//# sourceMappingURL=page.js.map