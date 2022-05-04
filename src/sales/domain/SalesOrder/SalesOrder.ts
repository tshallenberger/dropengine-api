import moment from "moment";
import { ResultError, IAggregate, Result } from "@shared/domain";

import { MongoSalesOrder } from "@sales/database";

import { ISalesOrder, ISalesOrderProps } from "./ISalesOrder";
import { SalesOrderNumber } from "./SalesOrderNumber";
import { OrderStatus, SalesOrderStatus } from "./SalesOrderStatus";
import { SalesOrderCustomer } from "./SalesOrderCustomer";
import { SalesOrderAddress } from "./SalesOrderAddress";
import { SalesOrderID } from "./SalesOrderID";
import { ILineItemProperty, LineItem, LineItemID } from "../SalesLineItem";
import { SalesOrderDate } from "./SalesOrderDate";
import { AddressDto, CreateOrderDto } from "@sales/dto";
import { AccountId } from "@auth/domain/valueObjects/AccountId";
import { EditShippingAddressDto } from "@sales/api";
import { HttpStatus, InternalServerErrorException } from "@nestjs/common";

/**
 * Aggregates need: events, domain methods, initializers, converters
 */
export enum SalesOrderError {
  InvalidSalesOrder = "InvalidSalesOrder",
  InvalidSalesOrderProperty = "InvalidSalesOrderProperty",
  FailedToCreateLineItems = "FailedToCreateLineItems",
  FailedToLoadLineItems = "FailedToLoadLineItems",
  InvalidShippingAddress = "InvalidShippingAddress",
}
export class InvalidSalesOrder implements ResultError {
  public stack: string;
  public name = SalesOrderError.InvalidSalesOrder;
  public message: string;
  constructor(
    public inner: ResultError[],
    public value: any,
    public reason: string
  ) {
    this.message = `${this.name} '${this.value.id}' '${this.value.name}': ${reason}`;
  }
}
export class FailedToCreateLineItemsError implements ResultError {
  public stack: string;
  public name = SalesOrderError.FailedToCreateLineItems;
  public value: any;

  public message: string;
  constructor(public inner: ResultError[], public reason: string) {
    this.message = `${this.name}: ${reason}`;
  }
}
export class FailedToLoadLineItemsError implements ResultError {
  public stack: string;
  public name = SalesOrderError.FailedToLoadLineItems;
  public message: string;
  public value: any;
  constructor(public inner: ResultError[], public reason: string) {
    this.message = `${this.name}: ${reason}`;
  }
}

export class SalesOrder extends IAggregate<
  ISalesOrderProps,
  ISalesOrder,
  MongoSalesOrder
> {
  protected _events: any[];
  private constructor(props: ISalesOrder, doc: MongoSalesOrder) {
    super(props, doc);
  }

  /**
   * Returns the database entity.
   * @returns {ISalesOrderProps}
   */
  public entity(): MongoSalesOrder {
    const value: MongoSalesOrder = this._entity;
    return Object.seal(value);
  }
  /**
   * Returns the raw props.
   * @returns {ISalesOrderProps}
   */
  public props(maxDepth?: number | undefined): ISalesOrderProps {
    const props: ISalesOrderProps = {
      id: this._value.id.value() || this._entity.id,
      accountId: this._value.accountId.value(),
      orderName: this._value.orderName,
      orderNumber: this._value.orderNumber.value(),
      orderDate: this._value.orderDate.value(),
      orderStatus: this._value.orderStatus.value(),
      lineItems: this._value.lineItems.map((li) => li.props()),
      customer: this._value.customer.value(),
      shippingAddress: this._value.shippingAddress.value(),
      billingAddress: this._value.billingAddress.value(),
      createdAt: this._value.createdAt,
      updatedAt: this._value.updatedAt,
    };
    return props;
  }

  /**
   * Returns the raw props.
   * @returns {ISalesOrderProps}
   */
  public value(): ISalesOrder {
    return Object.seal(this._value);
  }

  /** Domain Actions */

  public async updatePersonalization(dto: {
    lineItemId: string;
    personalization: ILineItemProperty[];
  }): Promise<SalesOrder> {
    let lineItem = this._value.lineItems.find(matchesLineItemId());
    if (lineItem) {
      await lineItem.updatePersonalization(dto.personalization);
    }
    return this;

    function matchesLineItemId(): (value: LineItem) => unknown {
      return (li) => li.id == dto.lineItemId;
    }
  }

  public async updateShippingAddress(
    dto: EditShippingAddressDto
  ): Promise<SalesOrder> {
    const result = await SalesOrderAddress.from(dto.shippingAddress);
    if (result.isFailure) {
      throw new InvalidShippingAddressException(
        {
          orderId: this._entity.id,
          shippingAddress: dto.shippingAddress,
        },
        result.error.message,
        SalesOrderError.InvalidShippingAddress,
        result.error.inner
      );
    }
    this._entity.shippingAddress = dto.shippingAddress;
    this._value.shippingAddress = result.value();
    return this;
  }

  /** Utility Methods */

  /**
   * Creates a SalesOrder from a DTO, or returns Result with errors.
   * @param dto Data Transfer Object representing a SalesOrder to be created.
   * @returns {Result<SalesOrder>}
   */
  public static async create(dto: CreateOrderDto): Promise<SalesOrder> {
    //TODO: ValidateLineItems

    let results: { [key: string]: Result<any> } = {};
    results.number = SalesOrderNumber.from(dto.orderNumber);
    results.orderDate = SalesOrderDate.from(dto.orderDate);
    results.status = SalesOrderStatus.from(OrderStatus.OPEN);
    results.customer = await SalesOrderCustomer.from(dto.customer);
    results.shippingAddress = await SalesOrderAddress.from(dto.shippingAddress);
    results.billingAddress = await SalesOrderAddress.from(dto.billingAddress);
    results.lineItems = SalesOrder.createLineItems(dto);
    results.accountId = AccountId.from(dto.accountId);
    // Errors
    let errors = Object.values(results)
      .filter((r) => r.isFailure)
      .map((r) => r as Result<any>)
      .map((r) => r.error);
    if (errors.length) {
      throw SalesOrder.invalidSalesOrder(errors, dto);
    }
    // Timestamp
    const now = moment().toDate();
    const orderNumber = results.number.value();
    const value: ISalesOrder = {
      id: SalesOrderID.from(null).value(),
      accountId: results.accountId.value(),
      orderName: dto.orderName,
      orderNumber: orderNumber,
      orderStatus: results.status.value(),
      lineItems: results.lineItems.value(),
      customer: results.customer.value(),
      shippingAddress: results.shippingAddress.value(),
      billingAddress: results.billingAddress.value(),
      updatedAt: now,
      createdAt: now,
      orderDate: results.orderDate.value(),
    };

    // DBEntity
    const doc: MongoSalesOrder = new MongoSalesOrder();
    doc.accountId = value.accountId.value();
    doc.orderNumber = value.orderNumber.value();
    doc.orderName = value.orderName;
    doc.orderStatus = value.orderStatus.value();
    doc.lineItems = value.lineItems.map((li) => li.entity());
    doc.customer = value.customer.value();
    doc.shippingAddress = value.shippingAddress.value();
    doc.billingAddress = value.billingAddress.value();
    doc.updatedAt = value.updatedAt;
    doc.createdAt = value.createdAt;
    doc.orderDate = value.orderDate.value();
    doc.orderName = value.orderName;
    // SalesOrder
    const aggregate = new SalesOrder(value, doc);

    return aggregate;
  }

  public static async load(doc: MongoSalesOrder): Promise<SalesOrder> {
    let results: { [key: string]: Result<any> } = {};
    results.number = SalesOrderNumber.from(doc.orderNumber);
    results.orderDate = SalesOrderDate.from(doc.orderDate);
    results.accountId = AccountId.from(doc.accountId);
    results.status = SalesOrderStatus.from(doc.orderStatus);
    results.customer = await SalesOrderCustomer.from(doc.customer);
    results.shippingAddress = await SalesOrderAddress.from(doc.shippingAddress);
    results.billingAddress = await SalesOrderAddress.from(doc.billingAddress);
    results.lineItems = SalesOrder.loadLineItems(doc);
    // Errors

    let errors = Object.values(results)
      .filter((r) => r.isFailure)
      .map((r) => r as Result<any>)
      .map((r) => r.error);
    if (errors.length) {
      throw SalesOrder.failedToLoadSalesOrder(errors, doc);
    }

    const orderNumber = results.number.value();
    const props: ISalesOrder = {
      id: SalesOrderID.from(doc._id).value(),
      accountId: results.accountId.value(),
      orderNumber: orderNumber,
      orderName: doc.orderName,
      orderStatus: results.status.value(),
      customer: results.customer.value(),
      shippingAddress: results.shippingAddress.value(),
      billingAddress: results.billingAddress.value(),
      lineItems: results.lineItems.value(),
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
      orderDate: results.orderDate.value(),
    };
    const value = new SalesOrder(props, doc);
    return value;
  }

  private static createLineItems(dto: CreateOrderDto): Result<LineItem[]> {
    let results = dto.lineItems.map((li) => LineItem.create(li));
    const failures = results
      .filter((res) => res.isFailure)
      .map((res) => res.error);
    const lineItems = results.filter((r) => r.isSuccess).map((r) => r.value());
    if (failures.length) {
      return Result.fail(SalesOrder.invalidLineItemsFound(failures));
    }
    return Result.ok(lineItems);
  }

  private static loadLineItems(doc: MongoSalesOrder): Result<LineItem[]> {
    let results = doc.lineItems.map((li) => LineItem.load(li));
    const failures = results
      .filter((res) => res.isFailure)
      .map((res) => res.error);
    const successes = results.filter((r) => r.isSuccess).map((r) => r.value());
    if (failures.length) {
      return Result.fail(SalesOrder.failedToLoadLineItems(failures));
    }
    return Result.ok(successes);
  }

  /** ERROR METHODS */

  private static invalidSalesOrder(
    errors: ResultError[],
    dto: CreateOrderDto
  ): ResultError {
    return new InvalidSalesOrder(
      errors,
      { ...dto },
      `Failed to create SalesOrder. See inner for details.`
    );
  }
  private static invalidLineItemsFound(failures: ResultError[]): ResultError {
    return new FailedToCreateLineItemsError(
      failures,
      `Failed to create LineItems. See inner for details.`
    );
  }
  private static failedToLoadSalesOrder(
    errors: ResultError[],
    doc: MongoSalesOrder
  ): ResultError {
    return new InvalidSalesOrder(
      errors,
      { ...doc },
      `Failed to load SalesOrder from Mongo. See inner for details.`
    );
  }
  private static failedToLoadLineItems(errors: ResultError[]): ResultError {
    return new FailedToLoadLineItemsError(
      errors,
      `Failed to load LineItems from Mongo. See inner error for details.`
    );
  }
}
export class InvalidShippingAddressException extends InternalServerErrorException {
  constructor(
    dto: {
      orderId: string;
      shippingAddress: AddressDto;
    },
    reason: any,
    type: SalesOrderError,
    inner: any[]
  ) {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          `Failed to update shipping address for order ` +
          `'${dto.orderId}': ` +
          `${reason}`,
        timestamp: moment().toDate(),
        error: type,
        details: {
          orderId: dto.orderId,
          shippingAddress: dto.shippingAddress,
          reason,
          inner,
        },
      },
      `Failed to update shipping address for order ` +
        `'${dto.orderId}': ` +
        `${reason}`
    );
  }
}
