import { Injectable, Scope } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UseCase } from "@shared/domain/UseCase";
import moment from "moment";
import { Result, ResultError } from "@shared/domain/Result";
import { UUID } from "@shared/domain/valueObjects";
import { EntityNotFoundException } from "@shared/exceptions/entitynotfound.exception";
import { AzureTelemetryService } from "@shared/modules/azure-telemetry/azure-telemetry.service";
import { Account } from "@accounts/domain/aggregates/Account";
import { User } from "@accounts/domain";
import { AccountId } from "@accounts/domain/valueObjects/AccountId";
import { AccountsRepository } from "@accounts/database/AccountsRepository";
import { IUpdateAccountMembersDto } from "@accounts/dto/UpdateAccountMembersDto";
import { Auth0MgmtApiClient } from "@auth0/Auth0MgmtApiClient";

@Injectable({ scope: Scope.DEFAULT })
export class RemoveMembersUseCase
  implements UseCase<IUpdateAccountMembersDto, Account>
{
  constructor(
    private eventEmitter: EventEmitter2,
    private logger: AzureTelemetryService,
    private auth0: Auth0MgmtApiClient,
    private _repo: AccountsRepository
  ) {}
  get llog() {
    return `[${moment()}][${RemoveMembersUseCase.name}]`;
  }

  async execute(dto: IUpdateAccountMembersDto): Promise<Result<Account>> {
    try {
      let resp = await this.auth0.getUser(dto.userId);
      let owner = User.fromAuth0User(resp);

      let result = await this._repo.loadById(dto.id);
      if (result.isFailure) {
        return Result.fail(result.error, dto.id.value());
      }
      let account = result.value();

      owner.removeAccount(account);
      let auth0Owner = owner.toAuth0();
      resp = await this.auth0.patchUserAppMetadata(
        auth0Owner.user_id,
        auth0Owner.app_metadata
      );
      return Result.ok(account);
    } catch (error) {
      return Result.fail(new ResultError(error, [error], {}));
    }
  }
}
