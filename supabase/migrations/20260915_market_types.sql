-- Market type: add 'Crypto' and make the column mandatory.
--
-- instrument_type already existed but was decorative: a badge on the account
-- card, read by nothing else. It now drives the sizing engine (lots vs whole
-- contracts vs fractional coin units), so it must be constrained and always
-- present -- a null market would silently fall back to lots and mis-size every
-- futures position.

alter table trading_accounts
  drop constraint if exists trading_accounts_instrument_type_check;

update trading_accounts
  set instrument_type = 'CFD'
  where instrument_type is null
     or instrument_type not in ('CFD', 'Futures', 'Crypto');

alter table trading_accounts
  alter column instrument_type set default 'CFD';

alter table trading_accounts
  alter column instrument_type set not null;

alter table trading_accounts
  add constraint trading_accounts_instrument_type_check
  check (instrument_type in ('CFD', 'Futures', 'Crypto'));

comment on column trading_accounts.instrument_type is
  'Market traded: CFD (lots), Futures (whole contracts), Crypto (fractional units). Drives position sizing.';
