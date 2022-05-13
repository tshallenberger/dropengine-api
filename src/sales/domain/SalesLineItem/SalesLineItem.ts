import moment from "moment";
import { IAggregate, Result, ResultError } from "@shared/domain";
import { ISalesLineItem, ISalesLineItemProps } from "./ISalesLineItem";
import { ILineItemProperty } from "../ValueObjects/ILineItemProperty";
import { SalesVariant } from "../SalesVariant";
import { Quantity } from "../ValueObjects/Quantity";
import { isNull } from "lodash";
import { CreateLineItemDto } from "@sales/dto";
import {
  OrderFlag,
  Personalization,
  LineItemID,
  LineNumber,
} from "../ValueObjects";
import { InvalidPersonalizationException } from "./InvalidPersonalizationException";
import { MongoSalesLineItem } from "@sales/database/mongo";

/**
 * Aggregates need: events, domain methods, initializers, converters
 */
export enum SalesLineItemError {
  InvalidLineItem = "InvalidLineItem",
  InvalidPersonalization = "InvalidPersonalization",
}
export class InvalidLineItem implements ResultError {
  public stack: string;
  public name = SalesLineItemError.InvalidLineItem;
  public message: string;
  constructor(
    public inner: ResultError[],
    public value: any,
    public reason: string
  ) {
    this.message = `${this.name} '${this.value?.lineNumber}': ${reason}`;
  }
}

export class SalesLineItem extends IAggregate<
  ISalesLineItemProps,
  ISalesLineItem,
  MongoSalesLineItem
> {
  private constructor(val: ISalesLineItem, doc: MongoSalesLineItem) {
    super(val, doc);
  }

  public get lineNumber(): number {
    return this._value.lineNumber.value();
  }

  public props(): ISalesLineItemProps {
    let props: ISalesLineItemProps = {
      lineNumber: this._value.lineNumber.value(),
      quantity: this._value.quantity.value(),
      variant: this._value.variant.props(),
      personalization: this._value.personalization.map((p) => ({
        name: p.name,
        value: p.value,
      })),
      flags: this._value.flags,
    };
    return props;
  }
  public entity(): MongoSalesLineItem {
    return Object.seal(this._entity);
  }

  /** VALIDATION */

  public validatePersonalization(): OrderFlag[] {
    const props = this.props();
    let flags = Personalization.validate(props);
    return flags;
  }

  public async updatePersonalization(
    personalization: ILineItemProperty[]
  ): Promise<SalesLineItem> {
    this._entity.personalization = personalization;
    this._value.personalization = personalization;
    let flags = this.validatePersonalization();
    if (flags.length) {
      console.error(flags);
      throw new InvalidPersonalizationException(
        { lineNumber: this.lineNumber, personalization, flags },
        `Flagged for validation errors.`,
        SalesLineItemError.InvalidPersonalization,
        flags
      );
    }
    return this;
  }

  /** UTILITY METHODS */

  public static create(dto: CreateLineItemDto): SalesLineItem {
    if (isNull(dto)) throw SalesLineItem.nullLineItem();
    const variantResult = SalesVariant.create(dto.variant);

    let results: { [key: string]: Result<any> } = {};
    results.lineNumber = LineNumber.from(dto.lineNumber);
    results.quantity = Quantity.from(dto.quantity);
    results.variant = variantResult;

    // Errors
    let errors = Object.values(results)
      .filter((r) => r.isFailure)
      .map((r) => r as Result<any>)
      .map((r) => r.error);
    if (errors.length) {
      throw SalesLineItem.invalidLineItem(errors, dto);
    }

    const now = moment().toDate();
    const variant = results.variant.value();

    const value: ISalesLineItem = {
      lineNumber: results.lineNumber.value(),
      quantity: results.quantity.value(),
      variant: variant,
      personalization: dto.properties.map((p) => ({
        name: p.name,
        value: p.value,
      })),
      flags: [],
    };

    const doc = new MongoSalesLineItem();
    doc.lineNumber = value.lineNumber.value();
    doc.quantity = value.quantity.value();
    doc.variant = value.variant.entity();
    doc.personalization = value.personalization;
    const lineItem = new SalesLineItem(value, doc);
    value.flags = lineItem.validatePersonalization();
    doc.flags = value.flags;
    return lineItem;
  }

  public static load(doc: MongoSalesLineItem): SalesLineItem {
    if (isNull(doc)) throw SalesLineItem.nullLineItem();
    const variantResult = SalesVariant.load(doc.variant);

    let results: { [key: string]: Result<any> } = {};

    results.lineNumber = LineNumber.from(doc.lineNumber);
    results.quantity = Quantity.from(doc.quantity);
    results.variant = variantResult;

    // Errors
    let errors = Object.values(results)
      .filter((r) => r.isFailure)
      .map((r) => r as Result<any>)
      .map((r) => r.error);
    if (errors.length) {
      throw SalesLineItem.failedToLoadLineItem(errors, doc);
    }

    const now = moment().toDate();
    const variant = results.variant.value();

    const value: ISalesLineItem = {
      lineNumber: results.lineNumber.value(),
      quantity: results.quantity.value(),
      variant: variant,
      personalization: doc.personalization.map((p) => ({
        name: p.name,
        value: p.value,
      })),
      flags: [],
    };

    const lineItem = new SalesLineItem(value, doc);
    value.flags = lineItem.validatePersonalization();
    doc.flags = value.flags;
    return lineItem;
  }
  private static nullLineItem(): ResultError {
    return new InvalidLineItem(
      [],
      null,
      `Failed to create LineItem. LineItem is undefined.`
    );
  }
  private static invalidLineItem(
    errors: ResultError[],
    dto: CreateLineItemDto
  ): ResultError {
    return new InvalidLineItem(
      errors,
      { ...dto },
      `Failed to create LineItem. See inner error for details.`
    );
  }

  private static failedToLoadLineItem(
    errors: ResultError[],
    doc: MongoSalesLineItem
  ): ResultError {
    return new InvalidLineItem(
      errors,
      { ...doc },
      `Failed to load LineItem. See inner error for details.`
    );
  }
}
