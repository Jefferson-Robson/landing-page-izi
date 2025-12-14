document.addEventListener('DOMContentLoaded', function() {
    
    const WHATSAPP_NUMBER = "5541996291417";
    let calculoPendente = null;

    // --- MÁSCARAS DE MOEDA ---
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

    // --- CONTROLE DAS ABAS ---
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

    // --- MOTOR DE CÁLCULO (PRICE COM AMORTIZAÇÃO) ---
    function simularCenario(saldoInicial, prazoAnos, taxaAnual, extraMensal) {
        let saldoDevedor = saldoInicial;
        let prazoMeses = prazoAnos * 12;
        let taxaMensal = (taxaAnual / 100) / 12;
        
        let totalJuros = 0;
        let mesesDecorridos = 0;
        let primeiraParcela = 0;

        // Loop mês a mês
        while (saldoDevedor > 1 && mesesDecorridos < prazoMeses) {
            mesesDecorridos++;
            
            // Fórmula Price para a parcela fixa baseada no prazo original
            let potencia = Math.pow(1 + taxaMensal, prazoMeses); 
            let parcelaBase = saldoInicial * ( (taxaMensal * potencia) / (potencia - 1) );
            
            if(mesesDecorridos === 1) primeiraParcela = parcelaBase;

            let jurosMes = saldoDevedor * taxaMensal;
            let amortizacaoNormal = parcelaBase - jurosMes;
            
            // Aqui entra a mágica: amortização normal + extra
            let amortizacaoTotal = amortizacaoNormal + extraMensal;

            if (amortizacaoTotal > saldoDevedor) {
                amortizacaoTotal = saldoDevedor; // Quitação final
            }

            saldoDevedor -= amortizacaoTotal;
            totalJuros += jurosMes;
        }

        return {
            totalJuros: totalJuros,
            mesesReais: mesesDecorridos,
            parcelaInicial: primeiraParcela
        };
    }

    // --- CALCULAR IMÓVEL ---
    document.getElementById('formImovel').addEventListener('submit', (e) => {
        e.preventDefault();
        const imovel = cleanNumber(document.getElementById('inputValorImovel').value);
        const entrada = cleanNumber(document.getElementById('inputEntrada').value);
        const extra = cleanNumber(document.getElementById('inputValorExtra').value);
        const anos = parseFloat(document.getElementById('inputPrazo').value);

        if(imovel <= 0 || entrada >= imovel) { alert("Valores inválidos. A entrada deve ser menor que o imóvel."); return; }

        const financiado = imovel - entrada;

        // 1. Cenário Padrão (Sem extra)
        const cenarioNormal = simularCenario(financiado, anos, 9.5, 0);
        
        // 2. Cenário Turbo (Com extra)
        const cenarioTurbo = simularCenario(financiado, anos, 9.5, extra);

        calculoPendente = {
            tipo: 'imovel',
            imovel: imovel,
            normal: cenarioNormal,
            turbo: cenarioTurbo,
            extra: extra
        };

        verificarLead();
    });

    // --- CALCULAR RENDA ---
    document.getElementById('formRenda').addEventListener('submit', (e) => {
        e.preventDefault();
        const renda = cleanNumber(document.getElementById('inputRendaMensal').value);
        const entrada = cleanNumber(document.getElementById('inputEntradaRenda').value);
        
        const parcelaMax = renda * 0.30; // 30% da renda
        const meses = 360; 
        const taxaMensal = (9.5 / 100) / 12;
        const potencia = Math.pow(1 + taxaMensal, meses);
        const valorFinanciavel = parcelaMax * ( (potencia - 1) / (taxaMensal * potencia) );
        
        calculoPendente = {
            tipo: 'renda',
            potencial: valorFinanciavel + entrada,
            renda: renda
        };

        verificarLead();
    });

    // --- LÓGICA DE LEAD (MODAL) ---
    function verificarLead() {
        if(localStorage.getItem('izi_lead_ok') === 'true') {
            mostrarResultado();
        } else {
            document.getElementById('modal-lead').classList.remove('hidden');
        }
    }
    
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('modal-lead').classList.add('hidden');
    });
    
    document.getElementById('formLead').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = document.getElementById('leadNome').value;
        const email = document.getElementById('leadEmail').value;
        
        if(nome && email) {
            localStorage.setItem('izi_lead_ok', 'true');
            // Disparo GTM
            if(window.dataLayer) window.dataLayer.push({'event': 'novo_lead_cadastrado'});
            
            document.getElementById('modal-lead').classList.add('hidden');
            mostrarResultado();
        }
    });

    // --- EXIBIR RESULTADOS ---
    function mostrarResultado() {
        const box = document.getElementById('resultadoBox');
        const boxImovel = document.getElementById('resConteudoImovel');
        const boxRenda = document.getElementById('resConteudoRenda');
        const boxEconomia = document.getElementById('boxEconomia');
        const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

        box.classList.remove('hidden');
        let msgZap = "";

        if(calculoPendente.tipo === 'imovel') {
            boxImovel.classList.remove('hidden');
            boxRenda.classList.add('hidden');

            const normal = calculoPendente.normal;
            const turbo = calculoPendente.turbo;
            const extra = calculoPendente.extra;

            document.getElementById('txtParcela').innerText = fmt.format(normal.parcelaInicial);
            document.getElementById('txtPrazoOriginal').innerText = normal.mesesReais + " meses";

            // Se tiver amortização extra
            if(extra > 0) {
                boxEconomia.classList.remove('hidden');
                
                const economiaJuros = normal.totalJuros - turbo.totalJuros;
                const mesesEconomizados = normal.mesesReais - turbo.mesesReais;
                const anosEconomizados = (mesesEconomizados / 12).toFixed(1);

                document.getElementById('txtValorExtraDisplay').innerText = fmt.format(extra);
                document.getElementById('txtEconomiaTotal').innerText = fmt.format(economiaJuros);
                document.getElementById('txtNovoPrazo').innerText = turbo.mesesReais;
                document.getElementById('txtAnosEconomizados').innerText = anosEconomizados;

                msgZap = `Olá! Simulei um imóvel de ${fmt.format(calculoPendente.imovel)}. Vi que pagando ${fmt.format(extra)} extra, economizo ${fmt.format(economiaJuros)} e quito ${anosEconomizados} anos antes!`;
            } else {
                boxEconomia.classList.add('hidden');
                msgZap = `Olá! Simulei um imóvel de ${fmt.format(calculoPendente.imovel)}. A parcela estimada ficou ${fmt.format(normal.parcelaInicial)}.`;
            }

        } else {
            // Aba Renda
            boxImovel.classList.add('hidden');
            boxRenda.classList.remove('hidden');
            document.getElementById('txtPotencial').innerText = fmt.format(calculoPendente.potencial);
            msgZap = `Olá! Com minha renda de ${fmt.format(calculoPendente.renda)}, vi que posso financiar um imóvel de até ${fmt.format(calculoPendente.potencial)}.`;
        }

        document.getElementById('btnZap').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msgZap)}`;
        
        // Disparo GTM do resultado
        if(window.dataLayer) {
            window.dataLayer.push({
                'event': 'generate_lead',
                'tipo_simulacao': calculoPendente.tipo,
                'valor_principal': calculoPendente.imovel || calculoPendente.potencial
            });
        }

        box.scrollIntoView({ behavior: 'smooth' });
    }
});