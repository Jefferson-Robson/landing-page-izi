document.addEventListener('DOMContentLoaded', function() {
    
    const WHATSAPP_NUMBER = "5541996291417";
    let calculoPendente = null;

    // --- MÁSCARAS ---
    const inputs = ['inputValorImovel', 'inputEntrada', 'inputValorExtra', 'inputRendaMensal', 'inputEntradaRenda'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, "");
                value = (value/100).toFixed(2) + "";
                value = value.replace(".", ",");
                value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
                e.target.value = value === "NaN" ? "" : "R$ " + value;
            });
        }
    });

    function cleanNumber(val) {
        if(!val) return 0;
        return parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }

    // --- ABAS ---
    const tabs = document.querySelectorAll('.tab-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('resultadoBox').classList.add('hidden');
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.remove('hidden');
        });
    });

    // --- MOTOR DE CÁLCULO (SAC e PRICE) ---
    function simularFinanciamento(saldoInicial, prazoAnos, taxaAnual, sistema, extraMensal) {
        let saldoDevedor = saldoInicial;
        let prazoMeses = prazoAnos * 12;
        let taxaMensal = (taxaAnual / 100) / 12;
        
        let totalJuros = 0;
        let mesesDecorridos = 0;
        let primeiraParcela = 0;
        let ultimaParcela = 0;

        while (saldoDevedor > 0.01 && mesesDecorridos < prazoMeses) {
            mesesDecorridos++;
            
            let jurosMes = saldoDevedor * taxaMensal;
            let amortizacao = 0;
            let parcela = 0;

            if (sistema === 'sac') {
                amortizacao = saldoInicial / (prazoAnos * 12); 
                parcela = amortizacao + jurosMes;
            } else {
                let potencia = Math.pow(1 + taxaMensal, prazoMeses);
                let pmtPrice = saldoInicial * ( (taxaMensal * potencia) / (potencia - 1) );
                parcela = pmtPrice;
                amortizacao = parcela - jurosMes;
            }

            if(mesesDecorridos === 1) primeiraParcela = parcela;

            let amortizacaoTotal = amortizacao + extraMensal;
            
            if (amortizacaoTotal >= saldoDevedor) {
                amortizacaoTotal = saldoDevedor;
                parcela = amortizacaoTotal + jurosMes; 
                saldoDevedor = 0; 
            } else {
                saldoDevedor -= amortizacaoTotal;
            }

            totalJuros += jurosMes;
            if(parcela > 0) ultimaParcela = parcela;
        }

        return {
            totalJuros: totalJuros,
            mesesReais: mesesDecorridos,
            parcelaInicial: primeiraParcela,
            parcelaFinal: ultimaParcela
        };
    }

    // --- SUBMIT IMÓVEL ---
    document.getElementById('formImovel').addEventListener('submit', (e) => {
        e.preventDefault();
        const imovel = cleanNumber(document.getElementById('inputValorImovel').value);
        const entrada = cleanNumber(document.getElementById('inputEntrada').value);
        const extra = cleanNumber(document.getElementById('inputValorExtra').value);
        const anos = parseFloat(document.getElementById('inputPrazo').value);
        const sistema = document.getElementById('selectSistema').value;
        
        let taxaJuros = parseFloat(document.getElementById('inputTaxa').value);
        if(!taxaJuros || isNaN(taxaJuros)) taxaJuros = 9.5;

        if(imovel <= 0 || entrada >= imovel) { alert("A entrada deve ser menor que o valor do imóvel."); return; }

        const financiado = imovel - entrada;
        const cenarioNormal = simularFinanciamento(financiado, anos, taxaJuros, sistema, 0);
        const cenarioTurbo = simularFinanciamento(financiado, anos, taxaJuros, sistema, extra);

        calculoPendente = {
            tipo: 'imovel', imovel: imovel, normal: cenarioNormal, turbo: cenarioTurbo, extra: extra, sistema: sistema, taxa: taxaJuros
        };
        verificarLead();
    });

    // --- SUBMIT RENDA ---
    document.getElementById('formRenda').addEventListener('submit', (e) => {
        e.preventDefault();
        const renda = cleanNumber(document.getElementById('inputRendaMensal').value);
        const entrada = cleanNumber(document.getElementById('inputEntradaRenda').value);
        let taxaJuros = parseFloat(document.getElementById('inputTaxaRenda').value);
        if(!taxaJuros || isNaN(taxaJuros)) taxaJuros = 9.5;
        
        const parcelaMax = renda * 0.30;
        const taxaMensal = (taxaJuros / 100) / 12;
        const potencia = Math.pow(1 + taxaMensal, 360);
        const valorFinanciavel = parcelaMax * ( (potencia - 1) / (taxaMensal * potencia) );
        
        calculoPendente = { tipo: 'renda', potencial: valorFinanciavel + entrada, renda: renda, taxa: taxaJuros };
        verificarLead();
    });

    // --- MODAL ---
    function verificarLead() {
        if(localStorage.getItem('izi_lead_ok') === 'true') {
            mostrarResultado();
        } else {
            document.getElementById('modal-lead').classList.remove('hidden');
        }
    }
    document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('modal-lead').classList.add('hidden'));
    
    document.getElementById('formLead').addEventListener('submit', (e) => {
        e.preventDefault();
        if(document.getElementById('leadNome').value) {
            localStorage.setItem('izi_lead_ok', 'true');
            if(window.dataLayer) window.dataLayer.push({'event': 'novo_lead_cadastrado'});
            document.getElementById('modal-lead').classList.add('hidden');
            mostrarResultado();
        }
    });

    // --- EXIBIR RESULTADO ---
    function mostrarResultado() {
        const box = document.getElementById('resultadoBox');
        const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        box.classList.remove('hidden');
        let msgZap = "";

        if(calculoPendente.tipo === 'imovel') {
            document.getElementById('resConteudoImovel').classList.remove('hidden');
            document.getElementById('resConteudoRenda').classList.add('hidden');
            
            const normal = calculoPendente.normal;
            document.getElementById('txtParcela').innerText = fmt.format(normal.parcelaInicial);
            document.getElementById('txtUltimaParcela').innerText = fmt.format(normal.parcelaFinal);

            if(calculoPendente.extra > 0) {
                document.getElementById('boxEconomia').classList.remove('hidden');
                document.getElementById('txtValorExtraDisplay').innerText = fmt.format(calculoPendente.extra);
                document.getElementById('txtEconomiaTotal').innerText = fmt.format(normal.totalJuros - calculoPendente.turbo.totalJuros);
                let anosEco = ((normal.mesesReais - calculoPendente.turbo.mesesReais)/12).toFixed(1);
                if(anosEco < 0) anosEco = 0;
                document.getElementById('txtAnosEconomizados').innerText = anosEco;
                msgZap = `Simulei (${calculoPendente.sistema.toUpperCase()} a ${calculoPendente.taxa}%) um imóvel de ${fmt.format(calculoPendente.imovel)}. Com extra de ${fmt.format(calculoPendente.extra)}, economizo juros!`;
            } else {
                document.getElementById('boxEconomia').classList.add('hidden');
                msgZap = `Simulei (${calculoPendente.sistema.toUpperCase()} a ${calculoPendente.taxa}%) um imóvel de ${fmt.format(calculoPendente.imovel)}.`;
            }
        } else {
            document.getElementById('resConteudoImovel').classList.add('hidden');
            document.getElementById('resConteudoRenda').classList.remove('hidden');
            document.getElementById('txtPotencial').innerText = fmt.format(calculoPendente.potencial);
            msgZap = `Tenho renda de ${fmt.format(calculoPendente.renda)} e busco imóvel até ${fmt.format(calculoPendente.potencial)}.`;
        }
        document.getElementById('btnZap').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msgZap)}`;
        box.scrollIntoView({ behavior: 'smooth' });
    }
});