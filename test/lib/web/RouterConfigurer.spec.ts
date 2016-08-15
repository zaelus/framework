import { expect } from "chai";
import { stub, spy, match } from "sinon";
import { Router } from "express";
import { Interceptor } from "../../../src/lib/decorators/InterceptorDecorator";
import { RouterConfigurer } from "../../../src/lib/web/RouterConfigurer";
import { OrderUtil } from "../../../src/lib/decorators/OrderDecorator";
import { RouterConfigItem, RequestMethod } from "../../../src/lib/decorators/RequestMappingDecorator";

describe('RouterConfigurer', function () {

    @Interceptor()
    class PreHandleInterceptor {
        preHandle(request, response) {
            return !(request.originalUrl === 'brokenURL');
        }
        afterCompletion(request, response) {} // tslint:disable-line
    }

    @Interceptor()
    class PostHandleInterceptor {
        postHandle(request, response) {} // tslint:disable-line
    }

    let router: Router;
    let routerConfigurer: RouterConfigurer;
    let preHandleInterceptor: PreHandleInterceptor;
    let postHandleInterceptor: PostHandleInterceptor;

    beforeEach(() => {
        router = Router();
        routerConfigurer = new RouterConfigurer(router);
        preHandleInterceptor = new PreHandleInterceptor();
        postHandleInterceptor = new PostHandleInterceptor();
    });

    it('should initialize properly', async function () {
        // given / when / then
        expect((<any> routerConfigurer).interceptors).to.eql([]);
        expect((<any> routerConfigurer).routeHandlers).to.be.instanceOf(Map);
    });

    it('should register interceptors', async function () {
        // given
        let instanceA = new PreHandleInterceptor();
        let instanceB = new PostHandleInterceptor();

        // when
        routerConfigurer.registerInterceptor(instanceA);
        routerConfigurer.registerInterceptor(instanceB);

        // then
        expect((<any> routerConfigurer).interceptors.length).to.be.eql(2);
        expect((<any> routerConfigurer).interceptors).to.include(instanceA);
        expect((<any> routerConfigurer).interceptors).to.include(instanceB);
    });

    it('should register the handlers', async function () {
        // given
        let stubOnSetRouteHandler = stub((<any> routerConfigurer).routeHandlers, 'set');
        let routerConfigItem = new RouterConfigItem({path: 'path'}, 'handler');
        // when
        routerConfigurer.registerHandler(routerConfigItem, 'handler');

        // then
        expect(stubOnSetRouteHandler.calledOnce).to.be.true;
        expect(stubOnSetRouteHandler.calledWith(routerConfigItem, 'handler')).to.be.true;

        stubOnSetRouteHandler.restore();
    });

    it('should configure the router', async function () {
        // given
        let stubOnOrderList = stub(OrderUtil, 'orderList').returns(['firstInterceptor', 'secondInterceptor']);
        let stubOnConfigureMiddlewares = stub(routerConfigurer, 'configureMiddlewares');

        // when
        routerConfigurer.configure();

        // then
        expect(stubOnOrderList.calledOnce).to.be.true;
        expect(stubOnOrderList.calledWith([])).to.be.true;
        expect((<any> routerConfigurer).interceptors).to.eql(['firstInterceptor', 'secondInterceptor']);
        expect(stubOnConfigureMiddlewares.calledOnce).to.be.true;

        stubOnOrderList.restore();
        stubOnConfigureMiddlewares.restore();
    });

    it('should configure middlewares on router', async function () {
        // given
        let stubOnUse = stub((<any> routerConfigurer).router, 'use');
        let stubOnRegisterRouteHandlers = stub(routerConfigurer, 'registerRouteHandlers');
        let stubOnPreHandler = stub((<any> routerConfigurer).preHandler, 'bind')
            .returns('bound preHandler');
        let stubOnPostHandler = stub((<any> routerConfigurer).postHandler, 'bind')
            .returns('bound postHandler');
        let stubOnResolver = stub((<any> routerConfigurer).resolver, 'bind')
            .returns('bound resolver');
        let stubOnWrap = stub((<any> routerConfigurer), 'wrap');
        stubOnWrap.withArgs('bound preHandler').returns('wraped preHandler');
        stubOnWrap.withArgs('bound postHandler').returns('wraped postHandler');
        stubOnWrap.withArgs('bound resolver').returns('wraped resolver');

        // when
        (<any> routerConfigurer).configureMiddlewares();

        // then
        expect(stubOnUse.calledThrice).to.be.true;
        expect(stubOnUse.args).to.eql([['wraped preHandler'], ['wraped postHandler'], ['wraped resolver']]);
        expect(stubOnRegisterRouteHandlers.calledOnce).to.be.true;

        stubOnUse.restore();
        stubOnRegisterRouteHandlers.restore();
        stubOnPreHandler.restore();
        stubOnPostHandler.restore();
        stubOnResolver.restore();
        stubOnWrap.restore();
    });

    it('should register methods on routes', async function () {
        // given
        class A {

            get(request, response): Promise<any> {
                return Promise.resolve('GET resolved');
            }

            post(request, response): Promise<any> {
                return Promise.resolve('POST resolved');
            }
        }
        let instanceofA = new A();

        (<any> routerConfigurer).routeHandlers.clear();
        (<any> routerConfigurer).routeHandlers.set(
            new RouterConfigItem({path: '/get', method: RequestMethod.GET}, 'get'), instanceofA);
        let postConfig = new RouterConfigItem({path: '/post', method: RequestMethod.POST}, 'post');
        postConfig.view = 'viewName';
        (<any> routerConfigurer).routeHandlers.set(postConfig, instanceofA);
        let stubOnRouterGet = stub(router, RequestMethod.GET);
        let stubOnRouterPost = stub(router, RequestMethod.POST);
        let spyOnNext = spy();
        let mockResponseGet = {
            $$frameworkData: undefined
        };
        let mockResponsePost = {
            $$frameworkData: undefined
        };
        let spyOnControllerGet = spy(instanceofA, 'get');
        let spyOnControllerPost = spy(instanceofA, 'post');

        // when
        (<any> routerConfigurer).registerRouteHandlers();
        let getRequestCallback = stubOnRouterGet.args[0][1];
        let postRequestCallback = stubOnRouterPost.args[0][1];

        await getRequestCallback('requestGET', mockResponseGet, spyOnNext);
        await postRequestCallback('requestPOST', mockResponsePost, spyOnNext);

        // then
        expect(stubOnRouterGet.calledWith('/get', match.func)).to.be.true;
        expect(stubOnRouterPost.calledWith('/post', match.func)).to.be.true;
        expect(spyOnControllerGet.calledWith('requestGET', mockResponseGet)).to.be.true;
        expect(spyOnControllerPost.calledWith('requestPOST', mockResponsePost)).to.be.true;
        expect(mockResponseGet.$$frameworkData.model).to.be.eql('GET resolved');
        expect(mockResponseGet.$$frameworkData.view).to.be.undefined;
        expect(mockResponsePost.$$frameworkData.model).to.be.eql('POST resolved');
        expect(mockResponsePost.$$frameworkData.view).to.be.eql('viewName');
        expect(spyOnNext.calledTwice).to.be.true;

        // cleanup
        stubOnRouterGet.restore();
        stubOnRouterPost.restore();
    });

    it('should pre handle', async function () {
        // given
        let responseOne = {
            callback: undefined,
            on(event: string, callback: Function) {
                if (event === 'finish') {
                    this.callback = callback;
                }
            }
        };
        let responseTwo = {
            callback: undefined,
            on(event: string, callback: Function) {
                if (event === 'finish') {
                    this.callback = callback;
                }
            }
        };

        let spyOnPreHandle = spy(preHandleInterceptor, 'preHandle');
        let spyOnPostHandle = spy(postHandleInterceptor, 'postHandle');
        let spyOnAfterCompletion = spy(preHandleInterceptor, 'afterCompletion');
        let spyOnNext = spy();
        (<any> routerConfigurer).interceptors.push(preHandleInterceptor);
        (<any> routerConfigurer).interceptors.push(postHandleInterceptor);

        // when
        await (<any> routerConfigurer).preHandler('request', responseOne, spyOnNext);
        await (<any> routerConfigurer).preHandler({'originalUrl': 'brokenURL'}, responseTwo, spyOnNext);
        responseOne.callback();
        responseTwo.callback();

        // then
        expect(spyOnNext.calledOnce).to.be.true;
        expect(spyOnPreHandle.calledTwice).to.be.true;
        expect(spyOnPreHandle.calledWith('request', responseOne)).to.be.true;
        expect(spyOnPreHandle.calledWith({'originalUrl': 'brokenURL'}, responseTwo)).to.be.true;
        expect(spyOnAfterCompletion.calledTwice).to.be.true;
        expect(spyOnAfterCompletion.calledWith('request', responseOne)).to.be.true;
        expect(spyOnAfterCompletion.calledWith({'originalUrl': 'brokenURL'}, responseTwo)).to.be.true;
        expect(spyOnPostHandle.called).to.not.be.true;

        spyOnPreHandle.restore();
        spyOnPostHandle.restore();
        spyOnAfterCompletion.restore();
    });

    it('should post handle', async function () {
        // given
        let spyOnPreHandle = spy(preHandleInterceptor, 'preHandle');
        let spyOnPostHandle = spy(postHandleInterceptor, 'postHandle');
        let spyOnNext = spy();
        (<any> routerConfigurer).interceptors.push(preHandleInterceptor);
        (<any> routerConfigurer).interceptors.push(postHandleInterceptor);

        // when
        await (<any> routerConfigurer).postHandler('request', 'response', spyOnNext);

        // then
        expect(spyOnNext.calledOnce).to.be.true;
        expect(spyOnPreHandle.called).to.not.be.true;
        expect(spyOnPostHandle.calledOnce).to.be.true;
        expect(spyOnPostHandle.calledWith('request', 'response')).to.be.true;

        spyOnPreHandle.restore();
        spyOnPostHandle.restore();
    });

    it('should resolve response', async function () {
        // given
        let spyOnNext = spy();
        (<any> routerConfigurer).interceptors.push(preHandleInterceptor);
        (<any> routerConfigurer).interceptors.push(postHandleInterceptor);
        let mockResponseGet = {
            $$frameworkData: {
                model: 'getResult',
                view: undefined
            },
            json: spy(),
            render: spy(),
            finished: false
        };
        let mockResponsePost = {
            $$frameworkData: {
                model: 'postResult',
                view: 'postView'
            },
            json: spy(),
            render: spy(),
            finished: false
        };
        let mockBrokenResponse = {
            $$frameworkData: {
                model: 'brokenResult',
                view: undefined
            },
            json: spy(),
            render: spy(),
            finished: true
        };

        // when
        await (<any> routerConfigurer).resolver('mockRequest', mockResponseGet, spyOnNext);
        await (<any> routerConfigurer).resolver('mockRequest', mockResponsePost, spyOnNext);
        await (<any> routerConfigurer).resolver('mockRequest', mockBrokenResponse, spyOnNext);

        // then
        expect(mockResponseGet.json.calledOnce).to.be.true;
        expect(mockResponsePost.render.calledOnce).to.be.true;
        expect(mockResponseGet.json.calledWith('getResult')).to.be.true;
        expect(mockResponseGet.render.called).to.be.false;
        expect(mockResponsePost.json.called).to.be.false;
        expect(mockResponsePost.render.calledWith('postView', 'postResult')).to.be.true;
    });
});