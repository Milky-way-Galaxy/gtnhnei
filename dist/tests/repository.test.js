import { Repository } from '../repository';
import { setupRepository } from './setup';
describe('Repository', () => {
    beforeAll(async () => {
        await setupRepository();
    });
    it('should load repository data', () => {
        expect(Repository.current).toBeDefined();
    });
    it('should find items by id', () => {
        const item = Repository.current.GetById('i:gregtech:gt.blockmachines:1000');
        expect(item).toBeDefined();
        expect(item === null || item === void 0 ? void 0 : item.name).toBe('Electric Blast Furnace');
    });
    it('should find fluids by id', () => {
        const fluid = Repository.current.GetById('f:IC2:ic2steam');
        expect(fluid).toBeDefined();
        expect(fluid === null || fluid === void 0 ? void 0 : fluid.name).toBe('Steam');
    });
});
//# sourceMappingURL=repository.test.js.map