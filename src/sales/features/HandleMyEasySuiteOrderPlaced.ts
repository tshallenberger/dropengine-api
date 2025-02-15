import {
  Injectable,
  Scope,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { cloneDeep } from "lodash";

import { SalesOrderRepository } from "@sales/database/SalesOrderRepository";
import { UseCase } from "@shared/domain";
import { IdentityService } from "@identity/identity.service";

import {
  MyEasySuiteOrderPlaced,
  MyEasySuiteOrderEventName,
} from "@myeasysuite/domain/events";
import {
  PlaceOrder,
  PlaceOrderRequest,
  PlaceOrderRequestLineItem,
} from "@sales/features/PlaceOrder";
import { SalesCustomer, SalesOrder } from "@sales/domain";
import { extractOrderNumber } from "@sales/utils";
import { SalesMerchant } from "@sales/domain/model/SalesMerchant";

@Injectable({ scope: Scope.DEFAULT })
export class HandleMyEasySuiteOrderPlaced
  implements UseCase<MyEasySuiteOrderPlaced, void>
{
  private readonly logger: Logger = new Logger(
    HandleMyEasySuiteOrderPlaced.name
  );
  constructor(
    private readonly _auth: IdentityService,
    private readonly repo: SalesOrderRepository,
    private readonly placeOrder: PlaceOrder
  ) {}
  @OnEvent(MyEasySuiteOrderEventName.OrderPlaced, { async: true })
  async execute(dto: MyEasySuiteOrderPlaced): Promise<void> {
    this.logger.debug(
      `[RECEIVED] ${MyEasySuiteOrderEventName.OrderPlaced} '${dto.aggregateId}'`
    );
    let orderId = dto.aggregateId;
    let exists = await this.repo.existsWithName(orderId);
    // if (exists) {
    //   this.logger.debug(
    //     `[EXISTS] ${MyEasySuiteOrderEventName.OrderPlaced} '${dto.aggregateId}'`
    //   );
    //   return;
    // }
    const order = dto.details;

    let sdto = new PlaceOrderRequest();
    const merchant = order.store;
    sdto.merchant = new SalesMerchant({
      email: merchant.email,
      name: merchant.name,
      shopOrigin: merchant.shop_origin,
    });
    sdto.customer = new SalesCustomer();
    sdto.customer.email = order.customer_email;
    sdto.customer.name = order.customer_name;

    sdto.orderDate = new Date(order.order_date);
    sdto.orderName = order.order_id;
    sdto.orderNumber = extractOrderNumber(order.order_number);

    const shippingAddress = {
      ...order.shipping_address,
      countryCode: order.shipping_address.country_code,
      provinceCode: order.shipping_address.province_code,
      firstName: order.shipping_address.first_name,
      lastName: order.shipping_address.last_name,
      address3: "",
      phone: "",
    };
    const billingAddress = order.billing_address
      ? {
          ...order.billing_address,
          countryCode: order.billing_address.country_code,
          provinceCode: order.billing_address.province_code,
          firstName: order.billing_address.first_name,
          lastName: order.billing_address.last_name,
          address3: "",
          phone: "",
        }
      : cloneDeep(shippingAddress);
    sdto.shippingAddress = shippingAddress;
    sdto.billingAddress = billingAddress;
    let lineItems: PlaceOrderRequestLineItem[] = [];
    for (let i = 0; i < order.line_items.length; i++) {
      const li = order.line_items[i];
      let nli = new PlaceOrderRequestLineItem();
      nli.quantity = li.quantity;
      nli.sku = li.variant_sku;
      nli.properties = li.line_item_properties;
      lineItems.push(nli);
    }
    sdto.lineItems = lineItems;

    let accountCode = order.order_source;
    let result = await this._auth.findOrCreateAccountByCode(accountCode);
    if (result.isFailure) {
      this.logger.error(result.error);
      // TODO: Handle FailedToCreateMyEasySuiteOrder
      throw new InternalServerErrorException(
        `Account failed to be created for '${accountCode}'.`
      );
    }
    const account = result.value();
    sdto.seller = account.entity().companyCode;
    let salesOrder = await this.placeOrder.execute(sdto);
    this.logger.debug(`[CREATED] ${SalesOrder.name} '${salesOrder.id}'`);
  }
}
