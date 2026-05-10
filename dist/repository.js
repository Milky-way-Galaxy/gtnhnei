const charCodeItem = "i".charCodeAt(0);
const charCodeFluid = "f".charCodeAt(0);
const charCodeRecipe = "r".charCodeAt(0);
const DATA_VERSION = 5;
export class Repository {
    constructor(data) {
        this.objects = {};
        this.objectPositionMap = {};
        this.bytes = new Uint8Array(data);
        this.elements = new Int32Array(data);
        this.view = new DataView(data);
        this.textReader = new TextDecoder();
        let dataVersion = this.elements[0];
        if (dataVersion != DATA_VERSION)
            throw new Error(`Unsupported data version: ${dataVersion} (Required: ${DATA_VERSION}). This may be caused by the browser cache. Please try reloading using F5 or Ctrl+F5.`);
        this.items = this.GetSlice(this.elements[1]);
        this.fluids = this.GetSlice(this.elements[2]);
        this.oreDicts = this.GetSlice(this.elements[3]);
        this.recipeTypes = this.GetSlice(this.elements[4]);
        this.recipes = this.GetSlice(this.elements[5]);
        this.service = this.GetSlice(this.elements[6]);
        this.FillObjectPositionMap(this.items);
        this.FillObjectPositionMap(this.fluids);
        this.FillObjectPositionMap(this.oreDicts);
        this.FillObjectPositionMap(this.recipes);
        let remap = this.ReadSlice(this.elements[7]);
        this.FillRecipesRemap(remap);
    }
    static load(data) {
        const repository = new Repository(data);
        Repository.current = repository;
        return repository;
    }
    FillRecipesRemap(remap) {
        for (let i = 0; i < remap.length; i++) {
            let remapPos = remap[i];
            let id = this.GetString(this.elements[remapPos]);
            this.objectPositionMap[id] = this.elements[remapPos + 1];
        }
    }
    FillObjectPositionMap(elements) {
        for (var i = 0; i < elements.length; i++) {
            var id = this.GetString(this.elements[elements[i] + 4]);
            this.objectPositionMap[id] = elements[i];
        }
    }
    GetById(id) {
        if (!id)
            return null;
        var idCode = id.charCodeAt(0);
        var type = idCode == charCodeItem ? Item : idCode == charCodeFluid ? Fluid : idCode == charCodeRecipe ? Recipe : OreDict;
        if (!this.objectPositionMap[id])
            return null;
        return this.GetObject(this.objectPositionMap[id], type);
    }
    ObjectMatchQueryBits(query, pointer) {
        var arr = query.indexBits;
        for (var i = 0; i < 4; i++) {
            if ((this.elements[pointer + i] & arr[i]) !== arr[i])
                return false;
        }
        return true;
    }
    GetString(pointer) {
        var _a;
        if (pointer == -1)
            return null;
        return (_a = this.objects[pointer]) !== null && _a !== void 0 ? _a : (this.objects[pointer] = this.ReadString(pointer));
    }
    ReadString(pointer) {
        var length = this.elements[pointer];
        var begin = pointer * 4 + 4;
        return this.textReader.decode(this.bytes.subarray(begin, begin + length));
    }
    GetSlice(pointer) {
        var _a;
        return (_a = this.objects[pointer]) !== null && _a !== void 0 ? _a : (this.objects[pointer] = this.ReadSlice(pointer));
    }
    ReadSlice(pointer) {
        var length = this.elements[pointer];
        return this.elements.subarray(pointer + 1, pointer + 1 + length);
    }
    GetObject(pointer, prototype) {
        var _a;
        if (pointer === -1)
            return null;
        return (_a = this.objects[pointer]) !== null && _a !== void 0 ? _a : (this.objects[pointer] = this.ReadObject(pointer, prototype));
    }
    ReadObject(pointer, prototype) {
        return new prototype(this, pointer);
    }
    GetObjectIfMatchingSearch(query, pointer, prototype) {
        if (query === null)
            return this.GetObject(pointer, prototype);
        if (!this.ObjectMatchQueryBits(query, pointer))
            return null;
        var inst = this.GetObject(pointer, prototype);
        if (query.original.length === 1)
            return inst;
        return inst.MatchSearchText(query) ? inst : null;
    }
    IsObjectMatchingSearch(obj, query) {
        if (query === null)
            return true;
        if (!this.ObjectMatchQueryBits(query, obj.objectOffset))
            return false;
        if (query.original.length === 1)
            return true;
        return obj.MatchSearchText(query);
    }
}
class MemMappedObject {
    constructor(repository, offset) {
        this.repository = repository;
        this.objectOffset = offset;
    }
    GetInt(offset) {
        return this.repository.elements[offset + this.objectOffset];
    }
    GetDouble(offset) {
        return this.repository.view.getFloat64(4 * (offset + this.objectOffset), true);
    }
    GetString(offset) {
        return this.repository.GetString(this.repository.elements[offset + this.objectOffset]);
    }
    GetSlice(offset) {
        return this.repository.GetSlice(this.repository.elements[offset + this.objectOffset]);
    }
    GetArray(offset, prototype) {
        let slice = this.GetSlice(offset);
        let result = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
            result[i] = this.repository.GetObject(slice[i], prototype);
        }
        return result;
    }
    GetObject(offset, prototype) {
        return this.repository.GetObject(this.repository.elements[offset + this.objectOffset], prototype);
    }
}
class SearchableObject extends MemMappedObject {
    constructor() {
        super(...arguments);
        this.id = this.GetString(4);
    }
}
export class RecipeObject extends SearchableObject {
}
export class Goods extends RecipeObject {
    get name() { return this.GetString(5); }
    get mod() { return this.GetString(6); }
    get internalName() { return this.GetString(7); }
    get iconId() { return this.GetInt(9); }
    get tooltip() { return this.GetString(10); }
    get unlocalizedName() { return this.GetString(11); }
    get nbt() { return this.GetString(12); }
    get production() { return this.GetSlice(13); }
    get consumption() { return this.GetSlice(14); }
    MatchSearchText(query) {
        if (query.mod !== null && !this.mod.toLowerCase().includes(query.mod)) {
            return false;
        }
        return query.Match(this.name) || query.Match(this.tooltip);
    }
}
export class Item extends Goods {
    get stackSize() { return this.GetInt(15); }
    get damage() { return this.GetInt(16); }
    get container() { return this.GetObject(17, FluidContainer); }
    get tooltipDebugInfo() {
        var baseInfo = `${this.mod}:${this.internalName}:${this.damage}`;
        var nbt = this.nbt;
        if (nbt != null)
            baseInfo += "\n" + nbt;
        return baseInfo;
    }
}
export class FluidContainer extends MemMappedObject {
    get fluid() { return this.GetObject(0, Fluid); }
    get amount() { return this.GetInt(1); }
    get empty() { return this.GetObject(2, Item); }
}
export class Fluid extends Goods {
    get isGas() { return this.GetInt(15) === 1; }
    get containers() { return this.GetSlice(16); }
    get tooltipDebugInfo() {
        return `${this.mod}:${this.internalName}`;
    }
}
export class OreDict extends RecipeObject {
    constructor(repository, offset) {
        super(repository, offset);
        this.items = this.GetArray(5, Item);
    }
    MatchSearchText(query) {
        var items = this.items;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (this.repository.ObjectMatchQueryBits(query, item.objectOffset) && item.MatchSearchText(query))
                return true;
        }
        return false;
    }
}
export class RecipeType extends MemMappedObject {
    constructor(repository, offset) {
        super(repository, offset);
        this.singleblocks = this.GetArray(5, Item);
        this.defaultCrafter = this.GetObject(6, Item);
        this.multiblocks = this.GetArray(3, Item);
    }
    get name() { return this.GetString(0); }
    get category() { return this.GetString(1); }
    get dimensions() { return this.GetSlice(2); }
    get shapeless() { return this.GetInt(4) === 1; }
}
class GtRecipe extends MemMappedObject {
    get voltage() { return this.GetInt(0); }
    get durationTicks() { return this.GetInt(1); }
    get durationSeconds() { return this.GetInt(1) / 20; }
    get durationMinutes() { return this.GetInt(1) / (20 * 60); }
    get amperage() { return this.GetInt(2); }
    get voltageTier() { return this.GetInt(3); }
    get metadata() { return this.GetArray(4, GtRecipeMetadata); }
    get circuitConflicts() { return this.GetInt(5); }
    get specialValue() { return this.GetInt(6); }
    MetadataByKey(key, defaultValue = 0) {
        for (const metadata of this.metadata) {
            if (metadata.key === key) {
                return metadata.value;
            }
        }
        return defaultValue;
    }
}
export class GtRecipeMetadata extends MemMappedObject {
    get key() { return this.GetString(0); }
    get value() { return this.GetDouble(1); }
}
export var RecipeIoType;
(function (RecipeIoType) {
    RecipeIoType[RecipeIoType["ItemInput"] = 0] = "ItemInput";
    RecipeIoType[RecipeIoType["OreDictInput"] = 1] = "OreDictInput";
    RecipeIoType[RecipeIoType["FluidInput"] = 2] = "FluidInput";
    RecipeIoType[RecipeIoType["ItemOutput"] = 3] = "ItemOutput";
    RecipeIoType[RecipeIoType["FluidOutput"] = 4] = "FluidOutput";
})(RecipeIoType || (RecipeIoType = {}));
const RecipeIoTypePrototypes = [Item, OreDict, Fluid, Item, Fluid];
export class Recipe extends SearchableObject {
    constructor() {
        super(...arguments);
        this.recipeType = this.GetObject(6, RecipeType);
    }
    get gtRecipe() { return this.GetObject(7, GtRecipe); }
    get items() { var _a; return (_a = this.computedIo) !== null && _a !== void 0 ? _a : (this.computedIo = this.ComputeItems()); }
    ComputeItems() {
        var slice = this.GetSlice(5);
        var elements = slice.length / 5;
        var result = new Array(elements);
        var index = 0;
        for (var i = 0; i < elements; i++) {
            var type = slice[index++];
            var ptr = slice[index++];
            result[i] = {
                type: type,
                goodsPtr: ptr,
                goods: this.repository.GetObject(ptr, RecipeIoTypePrototypes[type]),
                slot: slice[index++],
                amount: slice[index++],
                probability: slice[index++] / 100,
            };
        }
        return result;
    }
    MatchSearchText(query) {
        var slice = this.GetSlice(5);
        var count = slice.length / 5;
        for (var i = 0; i < count; i++) {
            var pointer = slice[i * 5 + 1];
            if (!this.repository.ObjectMatchQueryBits(query, pointer))
                continue;
            var objType = RecipeIoTypePrototypes[slice[i * 5]];
            var obj = this.repository.GetObject(pointer, objType);
            if (obj.MatchSearchText(query))
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=repository.js.map