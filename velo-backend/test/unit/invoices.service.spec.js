"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const invoices_service_1 = require("../../src/invoices/invoices.service");
describe('InvoicesService.calculateFee', () => {
    let service;
    beforeEach(() => {
        service = new invoices_service_1.InvoicesService(null, null);
    });
    const cases = [
        { tier: 'standard', amount: 100, expectedFee: 0.75, expectedGross: 100.75, expectedNet: 100 },
        { tier: 'pro', amount: 100, expectedFee: 0.40, expectedGross: 100.40, expectedNet: 100 },
        { tier: 'enterprise', amount: 100, expectedFee: 0.75, expectedGross: 100.75, expectedNet: 100 },
    ];
    test.each(cases)('$tier tier: amount=$amount', ({ tier, amount, expectedFee, expectedGross, expectedNet }) => {
        const result = service.calculateFee(amount, tier);
        expect(parseFloat(result.fee_usdc)).toBeCloseTo(expectedFee, 4);
        expect(parseFloat(result.gross_usdc)).toBeCloseTo(expectedGross, 4);
        expect(parseFloat(result.net_usdc)).toBeCloseTo(expectedNet, 4);
    });
    it('pro tier: amount=100 -> fee=0.40, gross=100.40, net=100', () => {
        const result = service.calculateFee(100, 'pro');
        expect(parseFloat(result.fee_usdc)).toBeCloseTo(0.40, 4);
        expect(parseFloat(result.gross_usdc)).toBeCloseTo(100.40, 4);
        expect(parseFloat(result.net_usdc)).toBe(100);
    });
    it('handles zero amount edge case', () => {
        expect(() => service.calculateFee(0, 'standard')).not.toThrow();
    });
    it('handles large amount ($1M)', () => {
        const result = service.calculateFee(1_000_000, 'standard');
        expect(parseFloat(result.fee_usdc)).toBeCloseTo(500.25, 2);
    });
    it('enterprise custom fee', () => {
        const result = service.calculateFee(100, 'enterprise', 20, 0.05);
        expect(parseFloat(result.fee_usdc)).toBeCloseTo(0.25, 4);
    });
});
//# sourceMappingURL=invoices.service.spec.js.map