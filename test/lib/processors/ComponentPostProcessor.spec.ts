import {expect} from "chai";
import {
    ComponentPostProcessor,
    COMPONENT_POST_PROCESSOR_DECORATOR_TOKEN
} from "../../../src/lib/processors/ComponentPostProcessor";
import { ComponentUtil } from "../../../src/lib/decorators/ComponentDecorator";

describe('ComponentPostProcessor', function () {

    it('should add metadata', function () {
        // given
        @ComponentPostProcessor()
        class A {}

        // when
        let isPostProcessor = A[COMPONENT_POST_PROCESSOR_DECORATOR_TOKEN];

        // then
        expect(isPostProcessor).to.be.true;
        expect(ComponentUtil.isComponent(A)).to.be.true;
    });
});