/** Explicit entry form only. Never accept invitations automatically on boot/background refresh. */
export type ReferralEntryState = {authenticated:boolean;busy:boolean};
type EntryActions = {
  validate:(value:string)=>string;
  authenticate:()=>Promise<unknown>;
  onAuthenticated:()=>void;
  bind:(value:string)=>Promise<unknown>;
  open:()=>Promise<boolean>;
};
export async function completeReferralEntry(state:ReferralEntryState,input:string,actions:EntryActions):Promise<boolean>{
  if(state.busy)return false;
  state.busy=true;
  try{
    const code=input.trim()?actions.validate(input):'';
    if(!state.authenticated){await actions.authenticate();state.authenticated=true;actions.onAuthenticated();}
    if(code)await actions.bind(code);
    // Only now may home/push start their native-presence registration.
    if(!await actions.open())throw new Error('Conta acessada, mas os dados não carregaram. Tente continuar novamente.');
    state.authenticated=false;
    return true;
  }finally{state.busy=false;}
}
